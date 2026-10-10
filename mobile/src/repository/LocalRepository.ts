import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { withDatabaseTransaction } from '../database/transaction';
import { createBackupJson, restoreBackupJson } from '../backup/backupDatabase';

import {
  addDays, addMonths, calculatePeriod, daysBetween, parseIsoDate,
  type CycleRule, type HolidayCalendar, type IsoDate, type PeriodRange, type YearMonth,
} from '../domain/period';
import { homeMessage } from '../domain/homeMessage';
import type {
  Budget, CalendarMonth, DailyExpenses, Expense, ExpenseInput, HolidayYear, Home,
  Settings, SettingsInput, YearlyBudgetSummary,
} from './types';

type PeriodRow = {
  id: string; cycle_rule_id: string; label_month: string; start_date: string;
  nominal_end_date: string; end_date: string; budget_amount: number; budget_configured: number; updated_at: string;
};
type RuleRow = {
  id: string; start_day: number; adjust_for_weekends_and_holidays: number;
  effective_from: string; effective_to: string | null;
};
type ExpenseRow = {
  id: string; budget_period_id: string; spent_on: string; amount: number;
  memo: string | null; created_at: string; updated_at: string;
};
type SummaryRow = PeriodRow & {
  spent_amount: number; remaining_amount: number; expense_count: number;
};

const dateToday = (): IsoDate => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
const nowUtc = (): string => new Date().toISOString();

function validDate(date: IsoDate): IsoDate {
  parseIsoDate(date);
  return date;
}

function validBudgetAmount(amount: number): number {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 999_999_999) {
    throw new Error('今月使えるお金は0〜999,999,999円で入力してください');
  }
  return amount;
}

function validExpenseAmount(amount: number): number {
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 999_999_999) {
    throw new Error('金額は1〜999,999,999円で入力してください');
  }
  return amount;
}

function normalizedMemo(memo: string | null): string | null {
  if (memo === null) return null;
  if (memo.length > 120) throw new Error('メモは120文字以内で入力してください');
  return memo.trim() ? memo : null;
}

function required<T>(value: T | null, message: string): T {
  if (value === null) throw new Error(message);
  return value;
}

function periodRange(row: PeriodRow): PeriodRange {
  return {
    labelMonth: row.label_month, startDate: row.start_date,
    nominalEndDate: row.nominal_end_date, endDate: row.end_date,
  };
}

function cycleRule(row: RuleRow): CycleRule {
  return { startDay: row.start_day, adjustForWeekendsAndHolidays: row.adjust_for_weekends_and_holidays === 1 };
}

function expenseValue(row: ExpenseRow): Expense {
  return {
    id: row.id, budgetPeriodId: row.budget_period_id, spentOn: row.spent_on,
    amount: row.amount, memo: row.memo, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

async function transact<T>(db: SQLiteDatabase, action: (tx: SQLiteDatabase) => Promise<T>): Promise<T> {
  return withDatabaseTransaction(db, action);
}

async function calendarFrom(db: SQLiteDatabase): Promise<HolidayCalendar> {
  const years = await db.getAllAsync<{ calendar_year: number }>('SELECT calendar_year FROM holiday_calendar_coverage');
  const holidays = await db.getAllAsync<{ holiday_date: string }>('SELECT holiday_date FROM holidays');
  return {
    coveredYears: new Set(years.map((row) => row.calendar_year)),
    holidayDates: new Set(holidays.map((row) => row.holiday_date)),
  };
}

async function periodAt(db: SQLiteDatabase, date: IsoDate): Promise<PeriodRow | null> {
  return db.getFirstAsync<PeriodRow>(
    'SELECT * FROM budget_periods WHERE start_date <= ? AND end_date >= ? LIMIT 1', [date, date],
  );
}

async function ruleAt(db: SQLiteDatabase, date: IsoDate): Promise<RuleRow | null> {
  return db.getFirstAsync<RuleRow>(
    'SELECT * FROM budget_cycle_rules WHERE effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?) ORDER BY effective_from DESC LIMIT 1',
    [date, date],
  );
}

async function assertNoOverlap(db: SQLiteDatabase, range: PeriodRange, excludedId?: string, secondExcludedId?: string): Promise<void> {
  const overlap = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM budget_periods WHERE start_date <= ? AND end_date >= ? AND id <> ? AND id <> ? LIMIT 1',
    [range.endDate, range.startDate, excludedId ?? '', secondExcludedId ?? ''],
  );
  if (overlap) throw new Error('予算期間が既存の期間と重複しています');
}

async function insertPeriod(db: SQLiteDatabase, ruleId: string, range: PeriodRange, budget: number, configured = false): Promise<PeriodRow> {
  await assertNoOverlap(db, range);
  const id = Crypto.randomUUID();
  const timestamp = nowUtc();
  await db.runAsync(
    `INSERT INTO budget_periods
     (id, cycle_rule_id, label_month, start_date, nominal_end_date, end_date, budget_amount, budget_configured, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, ruleId, range.labelMonth, range.startDate, range.nominalEndDate, range.endDate, budget, configured ? 1 : 0, timestamp, timestamp],
  );
  return required(await db.getFirstAsync<PeriodRow>('SELECT * FROM budget_periods WHERE id = ?', [id]), '月度を作成できませんでした');
}

async function ensurePeriod(db: SQLiteDatabase, date: IsoDate): Promise<PeriodRow> {
  const found = await periodAt(db, date);
  if (found) return found;
  let earliest = required(
    await db.getFirstAsync<PeriodRow>('SELECT * FROM budget_periods ORDER BY start_date ASC LIMIT 1'),
    '月度が見つかりません。初期設定を行ってください',
  );
  if (date < earliest.start_date) {
    const calendar = await calendarFrom(db);
    while (date < earliest.start_date) {
      const previousMonth = addMonths(earliest.label_month.slice(0, 7), -1);
      const rule = required(await db.getFirstAsync<RuleRow>(
        'SELECT * FROM budget_cycle_rules WHERE id = ?', [earliest.cycle_rule_id],
      ), '前月度のルールが見つかりません');
      const range = calculatePeriod(previousMonth, cycleRule(rule), cycleRule(rule), calendar);
      if (addDays(range.endDate, 1) !== earliest.start_date) {
        throw new Error('月度の境界に空白または重複があります');
      }
      await db.runAsync('UPDATE budget_cycle_rules SET effective_from = ?, updated_at = ? WHERE id = ?',
        [range.startDate, nowUtc(), rule.id]);
      earliest = await insertPeriod(db, rule.id, range, 0);
    }
    return earliest;
  }
  let latest = required(
    await db.getFirstAsync<PeriodRow>('SELECT * FROM budget_periods ORDER BY end_date DESC LIMIT 1'),
    '月度が見つかりません。初期設定を行ってください',
  );
  const calendar = await calendarFrom(db);
  while (date > latest.end_date) {
    const nextMonth = addMonths(latest.label_month.slice(0, 7), 1);
    const nextDate = addDays(latest.end_date, 1);
    const rule = required(await ruleAt(db, nextDate), '次月度のルールが見つかりません');
    const range = calculatePeriod(nextMonth, cycleRule(rule), cycleRule(rule), calendar);
    if (range.startDate !== nextDate) throw new Error('月度の境界に空白または重複があります');
    latest = await insertPeriod(db, rule.id, range, 0);
  }
  return latest;
}

async function ensureMonth(db: SQLiteDatabase, month: YearMonth): Promise<PeriodRow> {
  const label = `${month}-01`;
  const found = await db.getFirstAsync<PeriodRow>('SELECT * FROM budget_periods WHERE label_month = ?', [label]);
  if (found) return found;
  const calendar = await calendarFrom(db);
  let earliest = required(await db.getFirstAsync<PeriodRow>(
    'SELECT * FROM budget_periods ORDER BY label_month ASC LIMIT 1',
  ), '月度が見つかりません。初期設定を行ってください');
  if (label < earliest.label_month) {
    while (label < earliest.label_month) {
      const previousMonth = addMonths(earliest.label_month.slice(0, 7), -1);
      const rule = required(await db.getFirstAsync<RuleRow>(
        'SELECT * FROM budget_cycle_rules WHERE id = ?', [earliest.cycle_rule_id],
      ), '前月度のルールが見つかりません');
      const range = calculatePeriod(previousMonth, cycleRule(rule), cycleRule(rule), calendar);
      if (addDays(range.endDate, 1) !== earliest.start_date) throw new Error('月度の境界に空白または重複があります');
      await db.runAsync('UPDATE budget_cycle_rules SET effective_from = ?, updated_at = ? WHERE id = ?',
        [range.startDate, nowUtc(), rule.id]);
      earliest = await insertPeriod(db, rule.id, range, 0);
    }
    return earliest;
  }
  let latest = required(await db.getFirstAsync<PeriodRow>(
    'SELECT * FROM budget_periods ORDER BY label_month DESC LIMIT 1',
  ), '月度が見つかりません。初期設定を行ってください');
  while (label > latest.label_month) {
    const nextMonth = addMonths(latest.label_month.slice(0, 7), 1);
    const nextDate = addDays(latest.end_date, 1);
    const rule = required(await ruleAt(db, nextDate), '次月度のルールが見つかりません');
    const range = calculatePeriod(nextMonth, cycleRule(rule), cycleRule(rule), calendar);
    if (range.startDate !== nextDate) throw new Error('月度の境界に空白または重複があります');
    latest = await insertPeriod(db, rule.id, range, 0);
  }
  if (latest.label_month !== label) throw new Error('月度の連続性を確認できません');
  return latest;
}

async function summaryAt(db: SQLiteDatabase, date: IsoDate): Promise<SummaryRow> {
  return required(
    await db.getFirstAsync<SummaryRow>(
      'SELECT * FROM budget_period_summary WHERE start_date <= ? AND end_date >= ? LIMIT 1', [date, date],
    ),
    '対象日の予算集計が見つかりません',
  );
}

export class LocalRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async isOnboardingComplete(): Promise<boolean> {
    const state = await this.db.getFirstAsync<{ completed: number }>(
      'SELECT completed FROM onboarding_state WHERE id = 1',
    );
    return state?.completed === 1;
  }

  async completeOnboarding(): Promise<void> {
    await this.db.runAsync('UPDATE onboarding_state SET completed = 1 WHERE id = 1');
  }

  async createBackupJson(): Promise<string> {
    return createBackupJson(this.db);
  }

  async restoreBackupJson(json: string): Promise<void> {
    await restoreBackupJson(this.db, json);
  }

  async isInitialized(): Promise<boolean> {
    return (await this.db.getFirstAsync<{ id: number }>('SELECT id FROM app_settings WHERE id = 1')) !== null;
  }

  async setup(budgetAmount: number, asOf: IsoDate = dateToday()): Promise<Settings> {
    validBudgetAmount(budgetAmount);
    validDate(asOf);
    return transact(this.db, async (tx) => {
      const existing = await tx.getFirstAsync<{ count: number }>(
        `SELECT (SELECT COUNT(*) FROM app_settings) + (SELECT COUNT(*) FROM budget_cycle_rules)
          + (SELECT COUNT(*) FROM budget_periods) AS count`,
      );
      if ((existing?.count ?? 0) > 0) throw new Error('初期設定は完了しています');
      const timestamp = nowUtc();
      await tx.runAsync(
        'INSERT INTO app_settings (id, monthly_notification_enabled, timezone, created_at, updated_at) VALUES (1, 1, ?, ?, ?)',
        ['Asia/Tokyo', timestamp, timestamp],
      );
      const ruleId = Crypto.randomUUID();
      const rule: CycleRule = { startDay: 1, adjustForWeekendsAndHolidays: false };
      const range = calculatePeriod(asOf.slice(0, 7), rule, rule, await calendarFrom(tx));
      await tx.runAsync(
        `INSERT INTO budget_cycle_rules
         (id, start_day, adjust_for_weekends_and_holidays, effective_from, effective_to, created_at, updated_at)
         VALUES (?, 1, 0, ?, NULL, ?, ?)`,
        [ruleId, range.startDate, timestamp, timestamp],
      );
      await insertPeriod(tx, ruleId, range, budgetAmount, true);
      return this.settingsWithin(tx, asOf);
    });
  }

  async getHome(asOf: IsoDate = dateToday()): Promise<Home> {
    validDate(asOf);
    return transact(this.db, async (tx) => {
      await ensurePeriod(tx, asOf);
      const summary = await summaryAt(tx, asOf);
      const today = await tx.getFirstAsync<{ total: number }>(
        'SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE spent_on = ?', [asOf],
      );
      return {
        labelMonth: summary.label_month, budgetAmount: summary.budget_amount,
        spentAmount: summary.spent_amount, remainingAmount: summary.remaining_amount,
        todayExpense: today?.total ?? 0, remainingDays: daysBetween(asOf, summary.end_date) + 1,
        message: homeMessage(summary.budget_amount, summary.remaining_amount, daysBetween(asOf, summary.end_date) + 1),
      };
    });
  }

  async getCurrentBudget(asOf: IsoDate = dateToday()): Promise<Budget> {
    validDate(asOf);
    return transact(this.db, async (tx) => {
      const period = await ensurePeriod(tx, asOf);
      const summary = await summaryAt(tx, asOf);
      return {
        budgetPeriodId: period.id, labelMonth: period.label_month,
        budgetAmount: period.budget_amount, remainingAmount: summary.remaining_amount,
        updatedAt: period.updated_at,
      };
    });
  }

  async updateCurrentBudget(amount: number, asOf: IsoDate = dateToday()): Promise<Budget> {
    validBudgetAmount(amount);
    validDate(asOf);
    return transact(this.db, async (tx) => {
      const period = await ensurePeriod(tx, asOf);
      const spent = (await summaryAt(tx, asOf)).spent_amount;
      const updatedAt = nowUtc();
      await tx.runAsync('UPDATE budget_periods SET budget_amount = ?, budget_configured = 1, updated_at = ? WHERE id = ?', [amount, updatedAt, period.id]);
      return { budgetPeriodId: period.id, labelMonth: period.label_month, budgetAmount: amount,
        remainingAmount: amount - spent, updatedAt };
    });
  }

  async createExpense(input: ExpenseInput): Promise<Expense> {
    validDate(input.spentOn);
    validExpenseAmount(input.amount);
    const memo = normalizedMemo(input.memo);
    return transact(this.db, async (tx) => {
      const period = await ensurePeriod(tx, input.spentOn);
      const id = Crypto.randomUUID();
      const timestamp = nowUtc();
      await tx.runAsync(
        `INSERT INTO expenses (id, budget_period_id, spent_on, amount, memo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, period.id, input.spentOn, input.amount, memo, timestamp, timestamp],
      );
      return { id, budgetPeriodId: period.id, spentOn: input.spentOn, amount: input.amount,
        memo, createdAt: timestamp, updatedAt: timestamp };
    });
  }

  async updateExpense(id: string, input: ExpenseInput): Promise<Expense> {
    validDate(input.spentOn);
    validExpenseAmount(input.amount);
    const memo = normalizedMemo(input.memo);
    return transact(this.db, async (tx) => {
      const original = required(
        await tx.getFirstAsync<ExpenseRow>('SELECT * FROM expenses WHERE id = ?', [id]), '支出が見つかりません',
      );
      const period = await ensurePeriod(tx, input.spentOn);
      const updatedAt = nowUtc();
      await tx.runAsync(
        `UPDATE expenses SET budget_period_id = ?, spent_on = ?, amount = ?, memo = ?, updated_at = ? WHERE id = ?`,
        [period.id, input.spentOn, input.amount, memo, updatedAt, id],
      );
      return { id, budgetPeriodId: period.id, spentOn: input.spentOn, amount: input.amount,
        memo, createdAt: original.created_at, updatedAt };
    });
  }

  async deleteExpense(id: string): Promise<void> {
    await transact(this.db, async (tx) => {
      const expense = await tx.getFirstAsync<ExpenseRow>('SELECT * FROM expenses WHERE id = ?', [id]);
      required(expense, '支出が見つかりません');
      await tx.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
    });
  }

  async getMonthlyCalendar(month: YearMonth): Promise<CalendarMonth> {
    parseIsoDate(`${month}-01`);
    return transact(this.db, async (tx) => {
      const period = await ensureMonth(tx, month);
      const totals = await tx.getAllAsync<{ spent_on: string; total_amount: number }>(
        `SELECT spent_on, SUM(amount) AS total_amount FROM expenses
         WHERE spent_on BETWEEN ? AND ? GROUP BY spent_on ORDER BY spent_on`,
        [period.start_date, period.end_date],
      );
      return {
        month, periodStart: period.start_date, periodEnd: period.end_date,
        dailyTotals: totals.map((row) => ({ date: row.spent_on, totalAmount: row.total_amount })),
      };
    });
  }

  async getDailyExpenses(date: IsoDate): Promise<DailyExpenses> {
    validDate(date);
    const rows = await this.db.getAllAsync<ExpenseRow>(
      'SELECT * FROM expenses WHERE spent_on = ? ORDER BY created_at ASC, id ASC', [date],
    );
    const expenses = rows.map(expenseValue);
    return { date, totalAmount: expenses.reduce((total, expense) => total + expense.amount, 0), expenses };
  }

  async getYearlySummary(year: number): Promise<YearlyBudgetSummary> {
    if (!Number.isInteger(year) || year < 1 || year > 9999) throw new Error('年は1〜9999で指定してください');
    const rows = await this.db.getAllAsync<SummaryRow>(
      'SELECT * FROM budget_period_summary WHERE label_month BETWEEN ? AND ?',
      [`${String(year).padStart(4, '0')}-01-01`, `${String(year).padStart(4, '0')}-12-01`],
    );
    const years = await this.db.getAllAsync<{ year: number }>(
      'SELECT DISTINCT CAST(substr(label_month, 1, 4) AS INTEGER) AS year FROM budget_periods ORDER BY year',
    );
    const byMonth = new Map(rows.map((row) => [Number(row.label_month.slice(5, 7)), row]));
    return {
      year, availableYears: years.map((row) => row.year),
      monthlySummaries: Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        const row = byMonth.get(month);
        return {
          month, budgetAmount: row?.budget_amount ?? 0, spentAmount: row?.spent_amount ?? 0,
          remainingAmount: row?.remaining_amount ?? 0, expenseCount: row?.expense_count ?? 0,
        };
      }),
    };
  }

  async getSettings(asOf: IsoDate = dateToday()): Promise<Settings> {
    validDate(asOf);
    return transact(this.db, async (tx) => {
      await ensurePeriod(tx, asOf);
      return this.settingsWithin(tx, asOf);
    });
  }

  private async settingsWithin(db: SQLiteDatabase, asOf: IsoDate): Promise<Settings> {
    const settings = required(await db.getFirstAsync<{ monthly_notification_enabled: number; timezone: string }>(
      'SELECT monthly_notification_enabled, timezone FROM app_settings WHERE id = 1',
    ), '設定が見つかりません');
    const current = required(await periodAt(db, asOf), '進行中の月度が見つかりません');
    const currentRule = required(await ruleAt(db, asOf), '月度のルールが見つかりません');
    const previousMonth = addMonths(current.label_month.slice(0, 7), -1);
    const existingPrevious = await db.getFirstAsync<PeriodRow>(
      'SELECT * FROM budget_periods WHERE label_month = ?', [`${previousMonth}-01`],
    );
    const previousRange = existingPrevious
      ? periodRange(existingPrevious)
      : calculatePeriod(previousMonth, cycleRule(currentRule), cycleRule(currentRule), await calendarFrom(db));
    const nextMonth = addMonths(current.label_month.slice(0, 7), 1);
    const existingNext = await db.getFirstAsync<PeriodRow>(
      'SELECT * FROM budget_periods WHERE label_month = ?', [`${nextMonth}-01`],
    );
    const nextRule = existingNext
      ? required(await db.getFirstAsync<RuleRow>('SELECT * FROM budget_cycle_rules WHERE id = ?', [existingNext.cycle_rule_id]), '次月度のルールが見つかりません')
      : (await ruleAt(db, addDays(current.end_date, 1))) ?? currentRule;
    const nextRange = existingNext
      ? periodRange(existingNext)
      : calculatePeriod(nextMonth, cycleRule(nextRule), cycleRule(nextRule), await calendarFrom(db));
    return {
      monthlyNotificationEnabled: settings.monthly_notification_enabled === 1,
      timezone: settings.timezone,
      ...cycleRule(nextRule), currentBudgetAmount: current.budget_amount,
      currentBudgetConfigured: current.budget_configured === 1,
      previousPeriodRange: previousRange, currentPeriodRange: periodRange(current), nextPeriodRange: nextRange,
    };
  }

  async updateSettings(input: SettingsInput, asOf: IsoDate = dateToday()): Promise<Settings> {
    validDate(asOf);
    if (!Number.isInteger(input.startDay) || input.startDay < 1 || input.startDay > 31) {
      throw new Error('月度の開始日は1〜31日で指定してください');
    }
    return transact(this.db, async (tx) => {
      await ensurePeriod(tx, asOf);
      const currentRule = required(await ruleAt(tx, asOf), '月度のルールが見つかりません');
      const changed = currentRule.start_day !== input.startDay
        || (currentRule.adjust_for_weekends_and_holidays === 1) !== input.adjustForWeekendsAndHolidays;
      if (changed) {
        const nextRule: CycleRule = {
          startDay: input.startDay,
          adjustForWeekendsAndHolidays: input.adjustForWeekendsAndHolidays,
        };
        const calendar = await calendarFrom(tx);
        const existing = await tx.getAllAsync<PeriodRow>('SELECT * FROM budget_periods ORDER BY label_month');
        const byMonth = new Map(existing.map(row => [row.label_month, row]));
        const firstMonth = existing[0].label_month.slice(0, 7);
        const lastMonth = existing[existing.length - 1].label_month.slice(0, 7);
        const ranges: PeriodRange[] = [];
        for (let month = firstMonth; ; month = addMonths(month, 1)) {
          ranges.push(calculatePeriod(month, nextRule, nextRule, calendar));
          if (month === lastMonth) break;
        }
        const expenseBounds = await tx.getFirstAsync<{ earliest: string | null; latest: string | null }>(
          'SELECT MIN(spent_on) AS earliest, MAX(spent_on) AS latest FROM expenses',
        );
        const earliestNeeded = expenseBounds?.earliest && expenseBounds.earliest < asOf ? expenseBounds.earliest : asOf;
        const latestNeeded = expenseBounds?.latest && expenseBounds.latest > asOf ? expenseBounds.latest : asOf;
        while (earliestNeeded < ranges[0].startDate) {
          ranges.unshift(calculatePeriod(addMonths(ranges[0].labelMonth.slice(0, 7), -1), nextRule, nextRule, calendar));
        }
        while (latestNeeded > ranges[ranges.length - 1].endDate) {
          ranges.push(calculatePeriod(addMonths(ranges[ranges.length - 1].labelMonth.slice(0, 7), 1), nextRule, nextRule, calendar));
        }
        const timestamp = nowUtc();
        const retainedRuleId = existing[0].cycle_rule_id;
        await tx.runAsync('UPDATE budget_periods SET cycle_rule_id = ? WHERE cycle_rule_id <> ?', [retainedRuleId, retainedRuleId]);
        await tx.runAsync('DELETE FROM budget_cycle_rules WHERE id <> ?', [retainedRuleId]);
        await tx.runAsync(
          `UPDATE budget_cycle_rules SET start_day = ?, adjust_for_weekends_and_holidays = ?,
           effective_from = ?, effective_to = NULL, updated_at = ? WHERE id = ?`,
          [input.startDay, input.adjustForWeekendsAndHolidays ? 1 : 0, ranges[0].startDate, timestamp, retainedRuleId],
        );
        for (const range of ranges) {
          const row = byMonth.get(range.labelMonth);
          if (!row) continue;
          await tx.runAsync(
            `UPDATE budget_periods SET cycle_rule_id = ?, start_date = ?, nominal_end_date = ?, end_date = ?, updated_at = ? WHERE id = ?`,
            [retainedRuleId, range.startDate, range.nominalEndDate, range.endDate, timestamp, row.id],
          );
        }
        for (const range of ranges) {
          if (!byMonth.has(range.labelMonth)) await insertPeriod(tx, retainedRuleId, range, 0);
        }
        for (let index = 1; index < ranges.length; index++) {
          if (addDays(ranges[index - 1].endDate, 1) !== ranges[index].startDate) {
            throw new Error('月度の境界に空白または重複があります');
          }
        }
        const uncovered = await tx.getFirstAsync<{ id: string }>(
          `SELECT e.id FROM expenses e LEFT JOIN budget_periods p
           ON e.spent_on BETWEEN p.start_date AND p.end_date WHERE p.id IS NULL LIMIT 1`,
        );
        if (uncovered) throw new Error('支出の日付に対応する月度がありません');
        await tx.runAsync(
          `UPDATE expenses SET budget_period_id =
           (SELECT p.id FROM budget_periods p WHERE expenses.spent_on BETWEEN p.start_date AND p.end_date LIMIT 1)
           WHERE budget_period_id <> (SELECT p.id FROM budget_periods p
             WHERE expenses.spent_on BETWEEN p.start_date AND p.end_date LIMIT 1)`,
        );
      }
      await tx.runAsync('UPDATE app_settings SET monthly_notification_enabled = ?, notification_hour = 9, notification_minute = 0, updated_at = ? WHERE id = 1',
        [input.monthlyNotificationEnabled ? 1 : 0, nowUtc()]);
      return this.settingsWithin(tx, asOf);
    });
  }

  async getUpcomingNotificationDates(asOf: IsoDate = dateToday(), count = 12): Promise<IsoDate[]> {
    validDate(asOf);
    if (!Number.isInteger(count) || count < 1 || count > 24) throw new Error('通知予約件数が不正です');
    const settings = await this.getSettings(asOf);
    const rule: CycleRule = { startDay: settings.startDay, adjustForWeekendsAndHolidays: settings.adjustForWeekendsAndHolidays };
    const calendar = await calendarFrom(this.db);
    const dates: IsoDate[] = [];
    for (let offset = 0; dates.length < count && offset <= count + 1; offset++) {
      const month = addMonths(settings.currentPeriodRange.labelMonth.slice(0, 7), offset);
      dates.push(calculatePeriod(month, rule, rule, calendar).startDate);
    }
    return dates;
  }

  async importHolidayYear(input: HolidayYear): Promise<void> {
    if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2200) throw new Error('祝日の対象年が不正です');
    if (!input.source || input.source.length > 255) throw new Error('祝日データの出典が不正です');
    const dates = new Set<string>();
    for (const holiday of input.holidays) {
      validDate(holiday.date);
      if (Number(holiday.date.slice(0, 4)) !== input.year || dates.has(holiday.date)) throw new Error('祝日の日付が重複または対象年外です');
      if (!holiday.name || holiday.name.length > 100) throw new Error('祝日の名称が不正です');
      dates.add(holiday.date);
    }
    await transact(this.db, async (tx) => {
      const existing = await tx.getFirstAsync<{ calendar_year: number }>(
        'SELECT calendar_year FROM holiday_calendar_coverage WHERE calendar_year = ?', [input.year],
      );
      if (existing) throw new Error('この年の祝日データはすでに登録されています');
      const timestamp = nowUtc();
      await tx.runAsync('INSERT INTO holiday_calendar_coverage (calendar_year, source, imported_at) VALUES (?, ?, ?)',
        [input.year, input.source, timestamp]);
      for (const holiday of input.holidays) {
        await tx.runAsync(
          'INSERT INTO holidays (holiday_date, calendar_year, name, source, created_at) VALUES (?, ?, ?, ?, ?)',
          [holiday.date, input.year, holiday.name, input.source, timestamp],
        );
      }
    });
  }
}

