// The Lock Screen widget is registered only in the iOS entry point.
import type { Home } from '../repository/types';

export async function updateHomeWidget(_home: Home | null): Promise<void> {}
