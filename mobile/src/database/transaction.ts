import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

export async function withDatabaseTransaction<T>(
  db: SQLiteDatabase,
  action: (transaction: SQLiteDatabase) => Promise<T>,
): Promise<T> {
  let result!: T;
  if (Platform.OS === 'web') {
    // expo-sqlite does not implement exclusive transactions in browsers.
    await db.withTransactionAsync(async () => { result = await action(db); });
  } else {
    await db.withExclusiveTransactionAsync(async transaction => { result = await action(transaction); });
  }
  return result;
}
