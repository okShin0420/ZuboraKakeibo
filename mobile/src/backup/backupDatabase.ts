import type { SQLiteDatabase } from 'expo-sqlite';

import { withDatabaseTransaction } from '../database/transaction';

export const BACKUP_FORMAT = 'zubora-kakeibo-backup' as const;
export const BACKUP_VERSION = 2 as const;

type AppSettingsRow = {
  id: number;
  monthly_notification_enabled: number;
  notification_hour: number;
  notification_minute: number;
  timezone: string;
  created_at: string;
  updated_at: string;
};

type CycleRuleRow = {
  id: string;
  start_day: number;
  adjust_for_weekends_and_holidays: number;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
};

type BudgetPeriodRow = {
  id: string;
  cycle_rule_id: string;
  label_month: string;
  start_date: string;
  nominal_end_date: string;
  end_date: string;
  budget_amount: number;
  budget_configured: number;
  created_at: string;
  updated_at: string;
};

type ExpenseRow = {
  id: string;
  budget_period_id: string;
  spent_on: string;
  amount: number;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

export type BackupDocument = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  data: {
    settings: AppSettingsRow[];
    cycleRules: CycleRuleRow[];
    budgetPeriods: BudgetPeriodRow[];
    expenses: ExpenseRow[];
  };
};

const objectValue = (value: unknown, label: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label}の形式が正しくありません`);
  }
  return value as Record<string, unknown>;
};

const arrayValue = (value: unknown, label: string, max: number): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`${label}の形式が正しくありません`);
  if (value.length > max) throw new Error(`${label}の件数が多すぎます`);
  return value;
};

const stringValue = (value: unknown, label: string, max = 255): string => {
  if (typeof value !== 'string' || value.length < 1 || value.length > max) {
    throw new Error(`${label}が正しくありません`);
  }
  return value;
};

const integerValue = (value: unknown, label: string, min: number, max: number): number => {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    throw new Error(`${label}が正しくありません`);
  }
  return value as number;
};

const booleanInteger = (value: unknown, label: string): number => integerValue(value, label, 0, 1);

const uuid = (value: unknown, label: string): string => {
  const result = stringValue(value, label, 36);
  if (!/^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(result)) {
    throw new Error(`${label}が正しくありません`);
  }
  return result;
};

const isoDate = (value: unknown, label: string): string => {
  const date = stringValue(value, label, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`${label}が正しくありません`);
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`${label}が正しくありません`);
  }
  return date;
};

const timestamp = (value: unknown, label: string): string => {
  const result = stringValue(value, label, 64);
  if (result.length < 20 || Number.isNaN(Date.parse(result))) throw new Error(`${label}が正しくありません`);
  return result;
};

const nullableDate = (value: unknown, label: string): string | null => value === null ? null : isoDate(value, label);

const uniqueIds = (rows: { id: string }[], label: string): void => {
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error(`${label}のIDが重複しています`);
};

const nextDate = (date: string): string => {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
};

export function validateBackupDocument(input: unknown): BackupDocument {
  const root = objectValue(input, 'バックアップ');
  if (root.format !== BACKUP_FORMAT) throw new Error('ズボラ家計簿のバックアップファイルではありません');
  if (root.version !== 1 && root.version !== BACKUP_VERSION) {
    throw new Error(`未対応のバックアップバージョンです（対応: 1〜${BACKUP_VERSION}）`);
  }
  const exportedAt = timestamp(root.exportedAt, '作成日時');
  const data = objectValue(root.data, 'データ');

  const settings = arrayValue(data.settings, '設定', 1).map((value, index): AppSettingsRow => {
    const row = objectValue(value, `設定${index + 1}`);
    return {
      id: integerValue(row.id, '設定ID', 1, 1),
      monthly_notification_enabled: booleanInteger(row.monthly_notification_enabled, '通知設定'),
      notification_hour: row.notification_hour === undefined ? 9 : integerValue(row.notification_hour, '通知時', 0, 23),
      notification_minute: row.notification_minute === undefined ? 0 : integerValue(row.notification_minute, '通知分', 0, 59),
      timezone: stringValue(row.timezone, 'タイムゾーン', 64),
      created_at: timestamp(row.created_at, '設定作成日時'),
      updated_at: timestamp(row.updated_at, '設定更新日時'),
    };
  });
  if (settings.length !== 1) throw new Error('設定データは1件必要です');

  const cycleRules = arrayValue(data.cycleRules, '月度ルール', 10_000).map((value, index): CycleRuleRow => {
    const row = objectValue(value, `月度ルール${index + 1}`);
    const effectiveFrom = isoDate(row.effective_from, '適用開始日');
    const effectiveTo = nullableDate(row.effective_to, '適用終了日');
    if (effectiveTo !== null && effectiveTo < effectiveFrom) throw new Error('月度ルールの適用期間が正しくありません');
    return {
      id: uuid(row.id, '月度ルールID'),
      start_day: integerValue(row.start_day, '月度開始日', 1, 31),
      adjust_for_weekends_and_holidays: booleanInteger(row.adjust_for_weekends_and_holidays, '土日祝調整'),
      effective_from: effectiveFrom,
      effective_to: effectiveTo,
      created_at: timestamp(row.created_at, '月度ルール作成日時'),
      updated_at: timestamp(row.updated_at, '月度ルール更新日時'),
    };
  });
  if (cycleRules.length < 1 || cycleRules.filter(row => row.effective_to === null).length !== 1) {
    throw new Error('有効な月度ルールが1件必要です');
  }
  uniqueIds(cycleRules, '月度ルール');
  const orderedRules = [...cycleRules].sort((a, b) => a.effective_from.localeCompare(b.effective_from));
  for (let index = 1; index < orderedRules.length; index += 1) {
    const previous = orderedRules[index - 1];
    if (previous.effective_to === null || nextDate(previous.effective_to) !== orderedRules[index].effective_from) {
      throw new Error('月度ルールの適用期間に空白または重複があります');
    }
  }

  const budgetPeriods = arrayValue(data.budgetPeriods, '月度', 20_000).map((value, index): BudgetPeriodRow => {
    const row = objectValue(value, `月度${index + 1}`);
    const labelMonth = isoDate(row.label_month, '月度ラベル');
    const startDate = isoDate(row.start_date, '月度開始日');
    const nominalEndDate = isoDate(row.nominal_end_date, '月度基準終了日');
    const endDate = isoDate(row.end_date, '月度終了日');
    if (!labelMonth.endsWith('-01') || startDate > endDate || endDate > nominalEndDate) {
      throw new Error('月度の期間が正しくありません');
    }
    return {
      id: uuid(row.id, '月度ID'),
      cycle_rule_id: uuid(row.cycle_rule_id, '月度ルールID'),
      label_month: labelMonth,
      start_date: startDate,
      nominal_end_date: nominalEndDate,
      end_date: endDate,
      budget_amount: integerValue(row.budget_amount, '予算額', 0, 999_999_999),
      budget_configured: row.budget_configured === undefined
        ? (integerValue(row.budget_amount, '予算額', 0, 999_999_999) > 0 ? 1 : 0)
        : booleanInteger(row.budget_configured, '予算設定済み'),
      created_at: timestamp(row.created_at, '月度作成日時'),
      updated_at: timestamp(row.updated_at, '月度更新日時'),
    };
  });
  if (budgetPeriods.length < 1) throw new Error('月度データが必要です');
  uniqueIds(budgetPeriods, '月度');
  if (new Set(budgetPeriods.map(row => row.label_month)).size !== budgetPeriods.length) {
    throw new Error('月度ラベルが重複しています');
  }
  const ruleIds = new Set(cycleRules.map(row => row.id));
  if (budgetPeriods.some(row => !ruleIds.has(row.cycle_rule_id))) throw new Error('月度が存在しないルールを参照しています');
  const orderedPeriods = [...budgetPeriods].sort((a, b) => a.start_date.localeCompare(b.start_date));
  for (let index = 1; index < orderedPeriods.length; index += 1) {
    if (nextDate(orderedPeriods[index - 1].end_date) !== orderedPeriods[index].start_date) {
      throw new Error('月度の期間に空白または重複があります');
    }
  }

  const expenses = arrayValue(data.expenses, '支出', 1_000_000).map((value, index): ExpenseRow => {
    const row = objectValue(value, `支出${index + 1}`);
    const memo = row.memo === null ? null : typeof row.memo === 'string' && row.memo.length <= 120
      ? row.memo : stringValue(row.memo, 'メモ', 120);
    return {
      id: uuid(row.id, '支出ID'),
      budget_period_id: uuid(row.budget_period_id, '支出の月度ID'),
      spent_on: isoDate(row.spent_on, '支出日'),
      amount: integerValue(row.amount, '支出額', 1, 999_999_999),
      memo,
      created_at: timestamp(row.created_at, '支出作成日時'),
      updated_at: timestamp(row.updated_at, '支出更新日時'),
    };
  });
  uniqueIds(expenses, '支出');
  const periodsById = new Map(budgetPeriods.map(row => [row.id, row]));
  for (const expense of expenses) {
    const period = periodsById.get(expense.budget_period_id);
    if (!period) throw new Error('支出が存在しない月度を参照しています');
    if (expense.spent_on < period.start_date || expense.spent_on > period.end_date) {
      throw new Error('支出日が所属月度の範囲外です');
    }
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    data: { settings, cycleRules, budgetPeriods, expenses },
  };
}

export function parseBackupJson(json: string): BackupDocument {
  let input: unknown;
  try { input = JSON.parse(json); }
  catch { throw new Error('バックアップJSONを読み込めません'); }
  return validateBackupDocument(input);
}

export async function createBackupDocument(db: SQLiteDatabase): Promise<BackupDocument> {
  // 各テーブルを同一スナップショットから読む。途中の支出保存を混ぜない。
  return withDatabaseTransaction(db, async transaction => validateBackupDocument({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      settings: await transaction.getAllAsync<AppSettingsRow>('SELECT * FROM app_settings ORDER BY id'),
      cycleRules: await transaction.getAllAsync<CycleRuleRow>('SELECT * FROM budget_cycle_rules ORDER BY effective_from, id'),
      budgetPeriods: await transaction.getAllAsync<BudgetPeriodRow>('SELECT * FROM budget_periods ORDER BY label_month, id'),
      expenses: await transaction.getAllAsync<ExpenseRow>('SELECT * FROM expenses ORDER BY spent_on, created_at, id'),
    },
  }));
}

export async function createBackupJson(db: SQLiteDatabase): Promise<string> {
  return `${JSON.stringify(await createBackupDocument(db), null, 2)}\n`;
}

export async function restoreBackupDocument(db: SQLiteDatabase, document: BackupDocument): Promise<void> {
  const backup = validateBackupDocument(document);
  await withDatabaseTransaction(db, async transaction => {
    await transaction.runAsync('DELETE FROM expenses');
    await transaction.runAsync('DELETE FROM budget_periods');
    await transaction.runAsync('DELETE FROM budget_cycle_rules');
    await transaction.runAsync('DELETE FROM app_settings');

    for (const row of backup.data.settings) {
      await transaction.runAsync(
        `INSERT INTO app_settings
         (id, monthly_notification_enabled, notification_hour, notification_minute, timezone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.monthly_notification_enabled, 9, 0, row.timezone, row.created_at, row.updated_at],
      );
    }
    for (const row of backup.data.cycleRules) {
      await transaction.runAsync(
        `INSERT INTO budget_cycle_rules
         (id, start_day, adjust_for_weekends_and_holidays, effective_from, effective_to, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.start_day, row.adjust_for_weekends_and_holidays, row.effective_from,
          row.effective_to, row.created_at, row.updated_at],
      );
    }
    for (const row of backup.data.budgetPeriods) {
      await transaction.runAsync(
        `INSERT INTO budget_periods
         (id, cycle_rule_id, label_month, start_date, nominal_end_date, end_date, budget_amount, budget_configured, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.cycle_rule_id, row.label_month, row.start_date, row.nominal_end_date,
          row.end_date, row.budget_amount, row.budget_configured, row.created_at, row.updated_at],
      );
    }
    for (const row of backup.data.expenses) {
      await transaction.runAsync(
        `INSERT INTO expenses
         (id, budget_period_id, spent_on, amount, memo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.budget_period_id, row.spent_on, row.amount, row.memo, row.created_at, row.updated_at],
      );
    }
    const foreignKeyErrors = await transaction.getAllAsync<Record<string, unknown>>('PRAGMA foreign_key_check');
    if (foreignKeyErrors.length > 0) throw new Error('復元データの参照関係が正しくありません');
  });
}

export async function restoreBackupJson(db: SQLiteDatabase, json: string): Promise<void> {
  await restoreBackupDocument(db, parseBackupJson(json));
}
