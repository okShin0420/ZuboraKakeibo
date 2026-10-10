import { useMemo } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { LocalRepository } from './LocalRepository';

export function useLocalRepository(): LocalRepository {
  const db = useSQLiteContext();
  return useMemo(() => new LocalRepository(db), [db]);
}
