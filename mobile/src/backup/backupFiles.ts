import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { parseBackupJson } from './backupDatabase';

const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const MAX_AUTOMATIC_BACKUPS = 5;
const AUTOMATIC_BACKUP_NAME = /^auto-before-restore-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)-[0-9a-fA-F-]{36}\.json$/;
const SHARED_BACKUP_NAME = /^zubora-kakeibo-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-fA-F-]{36}\.json$/;
let lastAutomaticBackupTime = 0;

export type BackupRepository = {
  isInitialized(): Promise<boolean>;
  createBackupJson(): Promise<string>;
  restoreBackupJson(json: string): Promise<void>;
};

const fileStamp = (): string => `${new Date().toISOString().replace(/[:.]/g, '-')}-${Crypto.randomUUID()}`;

const automaticBackupsDirectory = (): Directory => new Directory(Paths.document, 'backups');
const pickedCopiesDirectory = (): Directory => new Directory(Paths.cache, 'DocumentPicker');

function deletePickedCopy(file: File): void {
  const prefix = `${pickedCopiesDirectory().uri.replace(/\/$/, '')}/`;
  // OSのファイルピッカーがアプリのキャッシュに作った直下のコピーだけを扱う。
  // 外部の原本や、それ以外のキャッシュは削除しない。
  const relative = file.uri.startsWith(prefix) ? file.uri.slice(prefix.length) : '';
  if (relative && !relative.includes('/') && file.exists) file.delete();
}

function automaticBackupStamp(): string {
  const latest = latestAutomaticBackupName();
  const match = latest?.match(AUTOMATIC_BACKUP_NAME);
  const savedTime = match ? Date.parse(match[1].replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, 'T$1:$2:$3.$4Z')) : 0;
  const time = Math.max(Date.now(), lastAutomaticBackupTime + 1, Number.isFinite(savedTime) ? savedTime + 1 : 0);
  lastAutomaticBackupTime = time;
  return `${new Date(time).toISOString().replace(/[:.]/g, '-')}-${Crypto.randomUUID()}`;
}

function automaticBackupFiles(): File[] {
  const directory = automaticBackupsDirectory();
  if (!directory.exists) return [];
  return directory.list().filter((item): item is File =>
    item instanceof File && AUTOMATIC_BACKUP_NAME.test(item.name));
}

function pruneAutomaticBackups(): void {
  const files = automaticBackupFiles().sort((a, b) => a.name.localeCompare(b.name));
  for (const file of files.slice(0, -MAX_AUTOMATIC_BACKUPS)) file.delete();
}

function writeFile(directory: Directory, name: string, json: string): File {
  const file = new File(directory, name);
  file.create({ intermediates: true });
  try { file.write(json); }
  catch (error) {
    if (file.exists) file.delete();
    throw error;
  }
  return file;
}

async function saveAutomaticBackup(repository: BackupRepository): Promise<string | null> {
  if (!(await repository.isInitialized())) return null;
  const json = await repository.createBackupJson();
  if (new TextEncoder().encode(json).byteLength > MAX_BACKUP_BYTES) {
    throw new Error('現在のデータが20MBを超えるため、自動バックアップできません');
  }
  const directory = automaticBackupsDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const name = `auto-before-restore-${automaticBackupStamp()}.json`;
  const file = writeFile(directory, name, json);
  if ((await file.text()) !== json) {
    file.delete();
    throw new Error('復元前の自動バックアップを確認できませんでした');
  }
  return name;
}

export function latestAutomaticBackupName(): string | null {
  const names = automaticBackupFiles().map(item => item.name).sort();
  return names.at(-1) ?? null;
}

export function deleteLocalBackupFiles(): void {
  for (const file of automaticBackupFiles()) file.delete();
  for (const entry of Paths.cache.list()) {
    if (entry instanceof File && SHARED_BACKUP_NAME.test(entry.name)) entry.delete();
  }
  const pickedCopies = pickedCopiesDirectory();
  if (pickedCopies.exists) {
    for (const entry of pickedCopies.list()) {
      if (entry instanceof File) deletePickedCopy(entry);
    }
  }
}

export async function shareBackup(repository: BackupRepository): Promise<string> {
  const json = await repository.createBackupJson();
  const name = `zubora-kakeibo-backup-${fileStamp()}.json`;
  const file = writeFile(Paths.cache, name, json);
  if (!(await Sharing.isAvailableAsync())) throw new Error('この端末ではファイル共有を利用できません');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: 'ズボラ家計簿のバックアップを保存',
  });
  return name;
}

export async function pickAndRestoreBackup(repository: BackupRepository): Promise<{ canceled: true } | {
  canceled: false;
  sourceName: string;
  automaticBackupName: string | null;
}> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return { canceled: true };
  const asset = result.assets[0];
  const source = new File(asset.uri);
  let json: string;
  try {
    if (asset.size !== undefined && asset.size > MAX_BACKUP_BYTES) throw new Error('バックアップファイルは20MB以下にしてください');
    json = await source.text();
    if (new TextEncoder().encode(json).byteLength > MAX_BACKUP_BYTES) throw new Error('バックアップファイルは20MB以下にしてください');
    // 無効なファイルでは自動バックアップもDB更新も行わない。
    parseBackupJson(json);
  } finally {
    // 読み取り・検証の成否によらずコピーを消す。削除失敗時もDBは変更しない。
    deletePickedCopy(source);
  }

  // 現在の状態を永続領域へ退避できた場合だけ復元へ進む。
  const automaticBackupName = await saveAutomaticBackup(repository);
  // 退避を検証できた後、DBを置き換える前に古い自動退避だけを整理する。
  // 整理に失敗した場合も現在のDBには触れない。
  pruneAutomaticBackups();
  await repository.restoreBackupJson(json);
  return { canceled: false, sourceName: asset.name, automaticBackupName };
}

export async function restoreLatestAutomaticBackup(repository: BackupRepository): Promise<string> {
  const name = latestAutomaticBackupName();
  if (!name) throw new Error('復元前のデータが見つかりません');
  const file = new File(automaticBackupsDirectory(), name);
  const size = file.info().size;
  if (size !== undefined && size > MAX_BACKUP_BYTES) throw new Error('バックアップファイルは20MB以下にしてください');
  const json = await file.text();
  if (new TextEncoder().encode(json).byteLength > MAX_BACKUP_BYTES) throw new Error('バックアップファイルは20MB以下にしてください');
  parseBackupJson(json);
  await saveAutomaticBackup(repository);
  pruneAutomaticBackups();
  await repository.restoreBackupJson(json);
  return name;
}
