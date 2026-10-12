import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import Module, { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const originalLoad = Module._load;
const files = new Map();
const directories = new Set();
let pickerResult;
let sharedFile;
let maxDocumentBytes = Infinity;
let undeletableFile;

class FakeDirectory {
  constructor(parent, name) { this.uri = `${parent.uri ?? parent}/${name}`; }
  get exists() { return directories.has(this.uri); }
  create() { directories.add(this.uri); }
  list() {
    return [...files.keys()].filter(uri => uri.startsWith(`${this.uri}/`))
      .map(uri => new FakeFile(uri));
  }
}

class FakeFile {
  constructor(parent, name) { this.uri = name === undefined ? parent : `${parent.uri ?? parent}/${name}`; }
  get name() { return this.uri.split('/').at(-1); }
  get exists() { return files.has(this.uri); }
  create() { files.set(this.uri, ''); }
  write(value) {
    const otherBytes = [...files.entries()].filter(([uri]) => uri.startsWith('document/') && uri !== this.uri)
      .reduce((sum, [, content]) => sum + new TextEncoder().encode(content).byteLength, 0);
    if (this.uri.startsWith('document/') && otherBytes + new TextEncoder().encode(value).byteLength > maxDocumentBytes) {
      throw new Error('容量不足');
    }
    files.set(this.uri, value);
  }
  async text() {
    if (!this.exists) throw new Error('ファイルが見つかりません');
    return files.get(this.uri);
  }
  info() { return { size: new TextEncoder().encode(files.get(this.uri) ?? '').byteLength }; }
  delete() {
    if (this.uri === undeletableFile) throw new Error('一時ファイルを削除できません');
    files.delete(this.uri);
  }
}

Module._load = function (request, parent, isMain) {
  if (request === 'expo-crypto') return { randomUUID };
  if (request === 'expo-document-picker') return { getDocumentAsync: async () => pickerResult };
  if (request === 'expo-file-system') return {
    Directory: FakeDirectory, File: FakeFile, Paths: { document: 'document', cache: {
      uri: 'cache',
      list: () => [...files.keys()].filter(uri => uri.startsWith('cache/')).map(uri => new FakeFile(uri)),
    } },
  };
  if (request === 'expo-sharing') return {
    isAvailableAsync: async () => true,
    shareAsync: async (uri, options) => { sharedFile = { uri, options }; },
  };
  if (request === './backupDatabase' && parent?.filename.endsWith('backupFiles.ts')) return {
    parseBackupJson(json) {
      const data = JSON.parse(json);
      if (data.format !== 'zubora-kakeibo-backup') throw new Error('バックアップ形式が不正です');
      return data;
    },
  };
  return originalLoad.call(this, request, parent, isMain);
};
require.extensions['.ts'] = (module, filename) => {
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  module._compile(code, filename);
};

const { deleteLocalBackupFiles, latestAutomaticBackupName, pickAndRestoreBackup, restoreLatestAutomaticBackup, shareBackup } =
  require('./backupFiles.ts');

const backup = value => JSON.stringify({ format: 'zubora-kakeibo-backup', value });
const repository = (value, initialized = true) => ({
  current: backup(value),
  restored: [],
  async isInitialized() { return initialized; },
  async createBackupJson() { return this.current; },
  async restoreBackupJson(json) { this.restored.push(json); this.current = json; },
});
const reset = () => {
  files.clear(); directories.clear(); pickerResult = undefined; sharedFile = undefined; maxDocumentBytes = Infinity;
  undeletableFile = undefined;
};
const autoFiles = () => [...files.entries()].filter(([uri]) => uri.startsWith('document/backups/'));

test('バックアップはJSONファイルとして共有できる', async () => {
  reset();
  const repo = repository('保存対象');
  const name = await shareBackup(repo);
  assert.match(name, /^zubora-kakeibo-backup-.*\.json$/);
  assert.equal(files.get(`cache/${name}`), backup('保存対象'));
  assert.equal(sharedFile.uri, `cache/${name}`);
  assert.equal(sharedFile.options.mimeType, 'application/json');
});

test('全データ削除ではアプリ内の自動退避と共有用一時ファイルだけを消す', async () => {
  reset();
  const name = await shareBackup(repository('共有用'));
  const autoName = `auto-before-restore-2026-10-11T09-00-00-000Z-${randomUUID()}.json`;
  directories.add('document/backups');
  files.set(`document/backups/${autoName}`, backup('自動退避'));
  files.set('document/backups/other.json', '残す');
  files.set('cache/other.json', '残す');
  directories.add('cache/DocumentPicker');
  files.set('cache/DocumentPicker/old-copy.json', backup('復元用コピー'));
  files.set('external/original.json', backup('外部の原本'));
  files.set('cache/DocumentPickerOther/other.json', '残す');
  deleteLocalBackupFiles();
  assert.equal(files.has(`cache/${name}`), false);
  assert.equal(files.has(`document/backups/${autoName}`), false);
  assert.equal(latestAutomaticBackupName(), null);
  assert.equal(files.get('document/backups/other.json'), '残す');
  assert.equal(files.get('cache/other.json'), '残す');
  assert.equal(files.has('cache/DocumentPicker/old-copy.json'), false);
  assert.equal(files.get('external/original.json'), backup('外部の原本'));
  assert.equal(files.get('cache/DocumentPickerOther/other.json'), '残す');
});

test('復元用コピーは成功・形式不正・サイズ超過・読み取り失敗・DB失敗のすべてで削除する', async () => {
  for (const failure of ['none', 'invalid', 'oversized', 'unreadable', 'database']) {
    reset();
    const uri = 'cache/DocumentPicker/copy.json';
    const repo = repository('現在');
    if (failure !== 'unreadable') files.set(uri, failure === 'invalid' ? '{}' : backup('復元先'));
    files.set('external/original.json', backup('原本'));
    pickerResult = { canceled: false, assets: [{ uri, name: 'copy.json', size: failure === 'oversized' ? 21 * 1024 * 1024 : undefined }] };
    if (failure === 'database') repo.restoreBackupJson = async () => { throw new Error('DB失敗'); };
    if (failure === 'none') {
      await pickAndRestoreBackup(repo);
      assert.equal(repo.current, backup('復元先'));
    } else {
      await assert.rejects(pickAndRestoreBackup(repo));
      assert.equal(repo.current, backup('現在'));
    }
    assert.equal(files.has(uri), false, failure);
    assert.equal(files.get('external/original.json'), backup('原本'));
  }
});

test('コピーの削除失敗時はDBを変更せず、外部のファイルは削除しない', async () => {
  reset();
  const repo = repository('現在');
  const uri = 'cache/DocumentPicker/copy.json';
  files.set(uri, backup('復元先'));
  undeletableFile = uri;
  pickerResult = { canceled: false, assets: [{ uri, name: 'copy.json' }] };
  await assert.rejects(pickAndRestoreBackup(repo), /一時ファイルを削除できません/);
  assert.equal(repo.current, backup('現在'));
  assert.equal(latestAutomaticBackupName(), null);
  for (const external of ['external/original.json', 'cache/DocumentPickerOther/copy.json']) {
    files.set(external, backup('外部'));
    pickerResult = { canceled: false, assets: [{ uri: external, name: 'copy.json' }] };
    await pickAndRestoreBackup(repo);
    assert.equal(files.get(external), backup('外部'));
  }
});

test('ファイルから復元する前に現在データを退避し、直前のデータへ戻せる', async () => {
  reset();
  const repo = repository('復元前');
  files.set('picked.json', backup('復元先'));
  pickerResult = { canceled: false, assets: [{ uri: 'picked.json', name: 'picked.json' }] };

  const result = await pickAndRestoreBackup(repo);
  assert.equal(result.canceled, false);
  assert.equal(files.get(`document/backups/${result.automaticBackupName}`), backup('復元前'));
  assert.equal(repo.current, backup('復元先'));
  assert.equal(latestAutomaticBackupName(), result.automaticBackupName);

  await restoreLatestAutomaticBackup(repo);
  assert.equal(repo.current, backup('復元前'));
  assert.deepEqual(repo.restored, [backup('復元先'), backup('復元前')]);
  assert.equal([...files.entries()].filter(([uri, value]) =>
    uri.startsWith('document/backups/') && value === backup('復元先')).length, 1);
});

test('不正なファイルは自動退避も復元もせず、選択取消しもデータを変えない', async () => {
  reset();
  const repo = repository('現在');
  files.set('invalid.json', JSON.stringify({ format: '別の形式' }));
  pickerResult = { canceled: false, assets: [{ uri: 'invalid.json', name: 'invalid.json' }] };
  await assert.rejects(pickAndRestoreBackup(repo), /バックアップ形式が不正/);
  assert.equal(repo.current, backup('現在'));
  assert.equal(latestAutomaticBackupName(), null);

  pickerResult = { canceled: true };
  assert.deepEqual(await pickAndRestoreBackup(repo), { canceled: true });
  assert.equal(repo.restored.length, 0);
});

test('初回設定前の復元は自動退避を作らずに取り込める', async () => {
  reset();
  const repo = repository('空の端末', false);
  files.set('picked.json', backup('持ち込みデータ'));
  pickerResult = { canceled: false, assets: [{ uri: 'picked.json', name: 'picked.json' }] };
  const result = await pickAndRestoreBackup(repo);
  assert.equal(result.automaticBackupName, null);
  assert.equal(repo.current, backup('持ち込みデータ'));
  assert.equal(latestAutomaticBackupName(), null);
});

test('100回の復元でも自動バックアップは新しい5件だけを保持する', async () => {
  reset();
  const repo = repository('最初');
  pickerResult = { canceled: false, assets: [{ uri: 'picked.json', name: 'picked.json' }] };
  files.set('document/backups/manual.json', backup('手動保存'));
  for (let index = 0; index < 100; index += 1) {
    files.set('picked.json', backup(`復元${index}`));
    await pickAndRestoreBackup(repo);
  }
  const automatic = autoFiles().filter(([uri]) => uri.includes('auto-before-restore-'));
  assert.equal(automatic.length, 5);
  assert.equal(files.get('document/backups/manual.json'), backup('手動保存'));
  assert.equal(repo.current, backup('復元99'));
  assert.equal(files.get(`document/backups/${latestAutomaticBackupName()}`), backup('復元98'));
  assert.ok(automatic.reduce((sum, [, content]) => sum + new TextEncoder().encode(content).byteLength, 0) < 1_000);
  await restoreLatestAutomaticBackup(repo);
  assert.equal(repo.current, backup('復元98'));
  assert.equal(autoFiles().filter(([uri]) => uri.includes('auto-before-restore-')).length, 5);
});

test('自動退避を保存できない容量不足では復元せず、元データを保持する', async () => {
  reset();
  const repo = repository('現在の予算・支出・メモ');
  files.set('picked.json', backup('復元先'));
  pickerResult = { canceled: false, assets: [{ uri: 'picked.json', name: 'picked.json' }] };
  files.set(`document/backups/auto-before-restore-2026-01-01T00-00-00-000Z-${randomUUID()}.json`, backup('以前の状態'));
  const before = autoFiles();
  maxDocumentBytes = new TextEncoder().encode(before[0][1]).byteLength;
  await assert.rejects(pickAndRestoreBackup(repo), /容量不足/);
  assert.equal(repo.current, backup('現在の予算・支出・メモ'));
  assert.deepEqual(repo.restored, []);
  assert.deepEqual(autoFiles(), before);
});
