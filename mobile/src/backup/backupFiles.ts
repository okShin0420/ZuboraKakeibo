import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { parseBackupJson } from './backupDatabase';

const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

export type BackupRepository = {
  isInitialized(): Promise<boolean>;
  createBackupJson(): Promise<string>;
  restoreBackupJson(json: string): Promise<void>;
};

const fileStamp = (): string => `${new Date().toISOString().replace(/[:.]/g, '-')}-${Crypto.randomUUID()}`;

const automaticBackupsDirectory = (): Directory => new Directory(Paths.document, 'backups');

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
  const directory = automaticBackupsDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const name = `auto-before-restore-${fileStamp()}.json`;
  const file = writeFile(directory, name, json);
  if ((await file.text()) !== json) {
    file.delete();
    throw new Error('復元前の自動バックアップを確認できませんでした');
  }
  return name;
}

export function latestAutomaticBackupName(): string | null {
  const directory = automaticBackupsDirectory();
  if (!directory.exists) return null;
  const names = directory.list().filter(item => item instanceof File &&
    /^auto-before-restore-\d{4}-\d{2}-\d{2}T.*\.json$/.test(item.name))
    .map(item => item.name).sort();
  return names.at(-1) ?? null;
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
  if (asset.size !== undefined && asset.size > MAX_BACKUP_BYTES) throw new Error('バックアップファイルは20MB以下にしてください');
  const source = new File(asset.uri);
  const json = await source.text();
  if (new TextEncoder().encode(json).byteLength > MAX_BACKUP_BYTES) throw new Error('バックアップファイルは20MB以下にしてください');

  // 復元対象を先に検証する。無効なファイルでは自動バックアップもDB更新も行わない。
  parseBackupJson(json);

  // 現在の状態を永続領域へ退避できた場合だけ復元へ進む。
  const automaticBackupName = await saveAutomaticBackup(repository);

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
  await repository.restoreBackupJson(json);
  return name;
}
