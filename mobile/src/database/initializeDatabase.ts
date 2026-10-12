import type { SQLiteDatabase } from 'expo-sqlite';

import { seedBundledHolidays } from './bundledHolidays';
import { migrations } from './migrations';
import { withDatabaseTransaction } from './transaction';

export const DATABASE_NAME = 'zubora-kakeibo.db';

export async function initializeDatabaseForStartup(db: SQLiteDatabase): Promise<void> {
  try {
    await initializeDatabase(db);
  } catch (error) {
    // ExpoのProviderはonInit失敗時の接続を保持しないため、ここで閉じる。
    // DBファイルは残し、再試行時には新しい接続で初期化する。
    try { await db.closeAsync(); } catch { /* 初期化の原因を優先する。 */ }
    throw error;
  }
}

export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  // 接続単位で有効にする。トランザクション中の変更はSQLiteに無視される。
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = versionRow?.user_version ?? 0;
  const latestVersion = migrations[migrations.length - 1].version;

  if (currentVersion > latestVersion) {
    throw new Error(`端末内DBのバージョン ${currentVersion} は、このアプリが対応する ${latestVersion} より新しいです。`);
  }

  if (currentVersion === 0) {
    const existingTable = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' LIMIT 1",
    );
    if (existingTable) {
      throw new Error('バージョン未設定の既存DBが見つかりました。データを保護するため自動移行を停止しました。');
    }
  }

  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue;
    if (migration.version !== currentVersion + 1) {
      throw new Error(`端末内DBの移行 ${currentVersion + 1} が見つかりません。`);
    }

    // SQLとバージョン更新を同じトランザクションに収め、失敗時は両方ロールバックする。
    await withDatabaseTransaction(db, async (transaction) => {
      await transaction.execAsync(migration.sql);
      await transaction.execAsync(`PRAGMA user_version = ${migration.version};`);
    });
    currentVersion = migration.version;
  }
  await seedBundledHolidays(db);
}
