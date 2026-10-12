import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import Module, { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'expo-crypto') return { randomUUID };
  if (request === 'react-native') return { Platform: { OS: 'node' } };
  return originalLoad.call(this, request, parent, isMain);
};
require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  module._compile(code, filename);
};

const { migrations } = require('../database/migrations.ts');
const { initializeDatabase, initializeDatabaseForStartup } = require('../database/initializeDatabase.ts');
const { seedBundledHolidays, bundledHolidays } = require('../database/bundledHolidays.ts');
const { BUNDLED_HOLIDAY_YEARS, HOLIDAY_COVERAGE_NOTICE } = require('../domain/period.ts');
const { calculatePeriod } = require('../domain/period.ts');
const { LocalRepository } = require('./LocalRepository.ts');

test('画面の祝日対応年は同梱データと一致する', () => {
  assert.deepEqual(Object.keys(bundledHolidays).map(Number), [...BUNDLED_HOLIDAY_YEARS]);
  assert.match(HOLIDAY_COVERAGE_NOTICE, /2025〜2027年/);
  assert.match(HOLIDAY_COVERAGE_NOTICE, /2028年以降.*土日のみ/);
});

test('2026・2027年の同梱祝日は内閣府公表済みの35日と一致し、振替休日も調整する', () => {
  // 内閣府 https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html （2026-10-12照合）
  const official = {
    2026: ['01-01', '01-12', '02-11', '02-23', '03-20', '04-29', '05-03', '05-04', '05-05',
      '05-06', '07-20', '08-11', '09-21', '09-22', '09-23', '10-12', '11-03', '11-23'],
    2027: ['01-01', '01-11', '02-11', '02-23', '03-21', '03-22', '04-29', '05-03', '05-04',
      '05-05', '07-19', '08-11', '09-20', '09-23', '10-11', '11-03', '11-23'],
  };
  for (const [year, dates] of Object.entries(official)) {
    assert.deepEqual(bundledHolidays[year].map(([date]) => date), dates.map(date => `${year}-${date}`));
  }
  const calendar = { coveredYears: new Set(BUNDLED_HOLIDAY_YEARS),
    holidayDates: new Set(Object.values(bundledHolidays).flat().map(([date]) => date)) };
  const rule = { startDay: 22, adjustForWeekendsAndHolidays: true };
  assert.equal(calculatePeriod('2027-03', rule, rule, calendar).startDate, '2027-03-19');
  const newYear = { ...rule, startDay: 1 };
  assert.equal(calculatePeriod('2027-12', newYear, newYear, calendar).endDate, '2027-12-30');
  assert.equal(calculatePeriod('2028-01', newYear, newYear, calendar).startDate, '2027-12-31');
});

test('起動時の初期化失敗では接続を閉じ、保存データを削除せず再試行できる', async () => {
  const db = new SqliteAdapter();
  let closed = 0;
  db.closeAsync = async () => { closed += 1; };
  try {
    await new LocalRepository(db).setup(12_345, '2026-10-12');
    const before = JSON.parse(await new LocalRepository(db).createBackupJson());
    db.native.exec('PRAGMA user_version = 999');
    await assert.rejects(initializeDatabaseForStartup(db), /より新しい/);
    assert.equal(closed, 1);
    assert.deepEqual(JSON.parse(await new LocalRepository(db).createBackupJson()).data, before.data);
    db.native.exec(`PRAGMA user_version = ${migrations.at(-1).version}`);
    await initializeDatabaseForStartup(db);
    assert.equal(closed, 1);
    assert.deepEqual(JSON.parse(await new LocalRepository(db).createBackupJson()).data, before.data);
  } finally { db.close(); }
});

test('起動時の接続終了失敗でも初期化の原因を保持する', async () => {
  const cause = new Error('DB破損');
  await assert.rejects(initializeDatabaseForStartup({
    execAsync: async () => { throw cause; },
    closeAsync: async () => { throw new Error('接続終了失敗'); },
  }), error => error === cause);
});

test('通知を9時固定にし、月度開始日変更に沿った今後の通知日を返す', async () => {
  const db = new SqliteAdapter();
  try {
    const repo = new LocalRepository(db);
    await repo.setup(10_000, '2026-10-07');
    const settings = await repo.updateSettings({
      monthlyNotificationEnabled: true,
      startDay: 8, adjustForWeekendsAndHolidays: false,
    }, '2026-10-07');
    assert.equal(settings.monthlyNotificationEnabled, true);
    const backup = JSON.parse(await repo.createBackupJson());
    assert.equal(backup.data.settings[0].notification_hour, 9);
    assert.equal(backup.data.settings[0].notification_minute, 0);
    delete backup.data.settings[0].notification_hour;
    delete backup.data.settings[0].notification_minute;
    await repo.restoreBackupJson(JSON.stringify(backup));
    const fixedTime = JSON.parse(await repo.createBackupJson()).data.settings[0];
    assert.equal(fixedTime.notification_hour, 9);
    assert.equal(fixedTime.notification_minute, 0);
    assert.deepEqual(await repo.getUpcomingNotificationDates('2026-10-07', 3),
      ['2026-09-08', '2026-10-08', '2026-11-08']);
  } finally { db.close(); }
});

test('通知日は土日祝調整後の月度開始日に合わせる', async () => {
  const db = new SqliteAdapter();
  try {
    await seedBundledHolidays(db);
    const repo = new LocalRepository(db);
    await repo.setup(10_000, '2026-10-07');
    await repo.updateSettings({ monthlyNotificationEnabled: true, startDay: 8,
      adjustForWeekendsAndHolidays: true }, '2026-10-07');
    assert.deepEqual(await repo.getUpcomingNotificationDates('2026-10-07', 4),
      ['2026-09-08', '2026-10-08', '2026-11-06', '2026-12-08']);
  } finally { db.close(); }
});

test('0円を設定済み予算として保存し、未設定の0円と区別する', async () => {
  const db = new SqliteAdapter();
  try {
    const repo = new LocalRepository(db);
    const initial = await repo.setup(0, '2026-10-06');
    assert.equal(initial.currentBudgetAmount, 0);
    assert.equal(initial.currentBudgetConfigured, true);

    const unconfigured = await repo.getSettings('2026-11-06');
    assert.equal(unconfigured.currentBudgetAmount, 0);
    assert.equal(unconfigured.currentBudgetConfigured, false);

    await repo.updateCurrentBudget(0, '2026-11-06');
    const configured = await repo.getSettings('2026-11-06');
    assert.equal(configured.currentBudgetAmount, 0);
    assert.equal(configured.currentBudgetConfigured, true);
  } finally { db.close(); }
});

class SqliteAdapter {
  constructor(migrate = true) {
    this.native = new DatabaseSync(':memory:');
    this.native.exec('PRAGMA foreign_keys = ON');
    if (!migrate) return;
    let currentVersion = 0;
    for (const migration of migrations) {
      if (migration.version <= currentVersion) continue;
      assert.equal(migration.version, currentVersion + 1);
      this.native.exec('BEGIN IMMEDIATE');
      try {
        this.native.exec(migration.sql);
        this.native.exec(`PRAGMA user_version = ${migration.version}`);
        this.native.exec('COMMIT');
        currentVersion = migration.version;
      } catch (error) {
        this.native.exec('ROLLBACK');
        throw error;
      }
    }
  }

  async execAsync(sql) { this.native.exec(sql); }

  async getFirstAsync(sql, params = []) {
    return this.native.prepare(sql).get(...params) ?? null;
  }

  async getAllAsync(sql, params = []) {
    return this.native.prepare(sql).all(...params);
  }

  async runAsync(sql, params = []) {
    return this.native.prepare(sql).run(...params);
  }

  async withExclusiveTransactionAsync(action) {
    this.native.exec('BEGIN IMMEDIATE');
    try {
      await action(this);
      this.native.exec('COMMIT');
    } catch (error) {
      this.native.exec('ROLLBACK');
      throw error;
    }
  }

  close() { this.native.close(); }
}

test('予算と支出の入力は7桁まで保存でき、8桁を拒否する', async () => {
  const db = new SqliteAdapter();
  try {
    const repo = new LocalRepository(db);
    await assert.rejects(repo.setup(10_000_000, '2026-10-11'), /9,999,999/);
    await repo.setup(9_999_999, '2026-10-11');
    assert.equal((await repo.getHome('2026-10-11')).budgetAmount, 9_999_999);
    await assert.rejects(repo.updateCurrentBudget(10_000_000, '2026-10-11'), /9,999,999/);
    const expense = await repo.createExpense({ spentOn: '2026-10-11', amount: 9_999_999, memo: null });
    assert.equal(expense.amount, 9_999_999);
    await assert.rejects(repo.createExpense({ spentOn: '2026-10-11', amount: 10_000_000, memo: null }), /9,999,999/);
    await assert.rejects(repo.updateExpense(expense.id, { spentOn: '2026-10-11', amount: 10_000_000, memo: null }), /9,999,999/);
  } finally { db.close(); }
});

test('全データ削除で予算・支出・設定と説明状態を初期化し、再設定できる', async () => {
  const db = new SqliteAdapter();
  try {
    const repo = new LocalRepository(db);
    await repo.completeOnboarding();
    await repo.setup(19_000, '2026-10-11');
    await repo.createExpense({ spentOn: '2026-10-11', amount: 1_000, memo: 'テスト' });
    await repo.deleteAllUserData();
    assert.equal(await repo.isInitialized(), false);
    assert.equal(await repo.isOnboardingComplete(), false);
    for (const table of ['expenses', 'budget_periods', 'budget_cycle_rules', 'app_settings']) {
      assert.equal((await db.getFirstAsync(`SELECT COUNT(*) AS count FROM ${table}`)).count, 0);
    }
    await repo.setup(5_000, '2026-10-11');
    assert.equal((await repo.getHome('2026-10-11')).remainingAmount, 5_000);
  } finally { db.close(); }
});

test('説明完了は初期設定と独立して保存され、復元後も維持される', async () => {
  const db = new SqliteAdapter();
  const sourceDb = new SqliteAdapter();
  try {
    const repo = new LocalRepository(db);
    const source = new LocalRepository(sourceDb);
    assert.equal(await repo.isInitialized(), false);
    assert.equal(await repo.isOnboardingComplete(), false);
    await repo.completeOnboarding();
    assert.equal(await repo.isOnboardingComplete(), true);
    assert.equal(await repo.isInitialized(), false);
    await source.setup(12_000, '2026-10-06');
    await repo.restoreBackupJson(await source.createBackupJson());
    assert.equal(await repo.isOnboardingComplete(), true);
    assert.equal(await repo.isInitialized(), true);
  } finally { db.close(); sourceDb.close(); }
});

test('初期設定・支出・予算・ホーム・カレンダー・グラフをSQLiteで読み書きする', async () => {
  const db = new SqliteAdapter();
  try {
    const repo = new LocalRepository(db);
    assert.equal(await repo.isInitialized(), false);
    const settings = await repo.setup(48_000, '2026-10-06');
    assert.equal(settings.previousPeriodRange.labelMonth, '2026-09-01');
    assert.equal(settings.previousPeriodRange.startDate, '2026-09-01');
    assert.equal(settings.currentPeriodRange.endDate, '2026-10-31');
    assert.equal(await repo.isInitialized(), true);
    const expense = await repo.createExpense({ spentOn: '2026-10-06', amount: 1200, memo: '  ' });
    assert.equal(expense.memo, null);
    assert.equal((await repo.getHome('2026-10-06')).remainingAmount, 46_800);
    assert.equal((await repo.getHome('2026-10-06')).todayExpense, 1200);
    assert.equal((await repo.getCurrentBudget('2026-10-06')).remainingAmount, 46_800);
    assert.equal((await repo.updateCurrentBudget(50_000, '2026-10-06')).remainingAmount, 48_800);
    const updated = await repo.updateExpense(expense.id, { spentOn: '2026-10-07', amount: 2000, memo: '昼食' });
    assert.equal(updated.createdAt, expense.createdAt);
    assert.equal((await repo.getDailyExpenses('2026-10-07')).totalAmount, 2000);
    assert.deepEqual((await repo.getMonthlyCalendar('2026-10')).dailyTotals, [
      { date: '2026-10-07', totalAmount: 2000 },
    ]);
    assert.equal((await repo.getYearlySummary(2026)).monthlySummaries[9].remainingAmount, 48_000);
    await repo.deleteExpense(expense.id);
    assert.equal((await repo.getDailyExpenses('2026-10-07')).totalAmount, 0);
    assert.deepEqual((await repo.getMonthlyCalendar('2026-10')).dailyTotals, []);
    assert.equal((await repo.getHome('2026-10-07')).remainingAmount, 50_000);
    await assert.rejects(repo.deleteExpense(expense.id), /支出が見つかりません/);
  } finally { db.close(); }
});

test('10月に初期設定しても2026年9月度を表示・記録できる', async () => {
  const db = new SqliteAdapter();
  try {
    const repo = new LocalRepository(db);
    await repo.setup(48_000, '2026-10-06');
    const september = await repo.getMonthlyCalendar('2026-09');
    assert.equal(september.periodStart, '2026-09-01');
    assert.equal(september.periodEnd, '2026-09-30');
    await repo.createExpense({ spentOn: '2026-09-15', amount: 900, memo: null });
    assert.equal((await repo.getHome('2026-09-15')).remainingAmount, -900);
    assert.equal((await repo.getYearlySummary(2026)).monthlySummaries[8].budgetAmount, 0);
    assert.equal((await repo.getYearlySummary(2026)).monthlySummaries[8].remainingAmount, -900);
  } finally { db.close(); }
});

test('将来の2030年12月度を表示して支出を登録できる', async () => {
  const db = new SqliteAdapter();
  try {
    const repo = new LocalRepository(db);
    await repo.setup(48_000, '2026-10-06');
    const future = await repo.getMonthlyCalendar('2030-12');
    assert.equal(future.month, '2030-12');
    const expense = await repo.createExpense({ spentOn: '2030-12-15', amount: 700, memo: null });
    assert.equal(expense.spentOn, '2030-12-15');
    assert.equal((await repo.getDailyExpenses('2030-12-15')).totalAmount, 700);
  } finally { db.close(); }
});

test('設定変更を現在の月度から反映し、今日が前月度へ移る場合も連続させる', async () => {
  const db = new SqliteAdapter();
  try {
    const repo = new LocalRepository(db);
    await repo.setup(48_000, '2026-10-06');
    const settings = await repo.updateSettings({
      monthlyNotificationEnabled: false, startDay: 18, adjustForWeekendsAndHolidays: false,
    }, '2026-10-06');
    assert.equal(settings.currentPeriodRange.labelMonth, '2026-09-01');
    assert.equal(settings.currentPeriodRange.endDate, '2026-10-17');
    assert.equal(settings.nextPeriodRange.startDate, '2026-10-18');
    assert.equal(settings.nextPeriodRange.endDate, '2026-11-17');
    assert.equal(settings.monthlyNotificationEnabled, false);
    assert.equal((await repo.getHome('2026-10-06')).labelMonth, '2026-09-01');
    assert.equal((await repo.getHome('2026-10-06')).budgetAmount, 0);
    assert.equal((await repo.getHome('2026-10-18')).budgetAmount, 48_000);
    assert.equal((await repo.getHome('2026-12-18')).labelMonth, '2026-12-01');
    assert.equal((await repo.getSettings('2026-12-18')).currentPeriodRange.startDate, '2026-12-18');
    assert.equal((await repo.getYearlySummary(2026)).monthlySummaries[11].budgetAmount, 0);
  } finally { db.close(); }
});

test('10月7日に8日へ変更すると8月度・9月度・10月度が全て8日始まりになる', async () => {
  const db = new SqliteAdapter();
  try {
    const repo = new LocalRepository(db);
    await repo.setup(48_000, '2026-10-07');
    await repo.getMonthlyCalendar('2026-09');
    const early = await repo.createExpense({ spentOn: '2026-09-07', amount: 300, memo: null });
    const today = await repo.createExpense({ spentOn: '2026-10-07', amount: 1200, memo: '昼食' });
    const settings = await repo.updateSettings({ monthlyNotificationEnabled: true,
      startDay: 8, adjustForWeekendsAndHolidays: false }, '2026-10-07');
    assert.equal(settings.currentPeriodRange.labelMonth, '2026-09-01');
    assert.deepEqual([settings.currentPeriodRange.startDate, settings.currentPeriodRange.endDate],
      ['2026-09-08', '2026-10-07']);
    assert.deepEqual([(await repo.getMonthlyCalendar('2026-08')).periodStart,
      (await repo.getMonthlyCalendar('2026-08')).periodEnd], ['2026-08-08', '2026-09-07']);
    assert.deepEqual([(await repo.getMonthlyCalendar('2026-10')).periodStart,
      (await repo.getMonthlyCalendar('2026-10')).periodEnd], ['2026-10-08', '2026-11-07']);
    assert.equal((await repo.getHome('2026-10-07')).remainingAmount, -1200);
    assert.equal((await repo.getHome('2026-10-08')).budgetAmount, 48_000);
    assert.equal((await repo.getDailyExpenses('2026-09-07')).expenses[0].id, early.id);
    assert.equal((await repo.getDailyExpenses('2026-10-07')).expenses[0].id, today.id);
    const graph = await repo.getYearlySummary(2026);
    assert.equal(graph.monthlySummaries[7].remainingAmount, -300);
    assert.equal(graph.monthlySummaries[8].remainingAmount, -1200);
    assert.equal(graph.monthlySummaries[9].budgetAmount, 48_000);
  } finally { db.close(); }
});

test('月度変更後は支出だけを移し、各月度の予算・ホーム・カレンダー・グラフを再集計する', async () => {
  const db = new SqliteAdapter();
  try {
    const repo = new LocalRepository(db);
    await repo.setup(48_000, '2026-10-06');
    const octoberExpense = await repo.createExpense({ spentOn: '2026-10-06', amount: 1200, memo: '昼食' });
    await repo.createExpense({ spentOn: '2026-09-15', amount: 300, memo: null });
    await repo.getHome('2026-11-06');
    await repo.updateCurrentBudget(7000, '2026-11-06');
    const novemberExpense = await repo.createExpense({ spentOn: '2026-11-05', amount: 500, memo: null });
    await repo.updateSettings({
      monthlyNotificationEnabled: true, startDay: 18, adjustForWeekendsAndHolidays: false,
    }, '2026-10-06');
    const home = await repo.getHome('2026-10-06');
    assert.equal(home.labelMonth, '2026-09-01');
    assert.equal(home.remainingAmount, -1200);
    assert.equal(home.todayExpense, 1200);
    assert.equal(home.remainingDays, 12);
    assert.equal((await repo.getMonthlyCalendar('2026-09')).dailyTotals[0].date, '2026-10-06');
    const graph = await repo.getYearlySummary(2026);
    assert.equal(graph.monthlySummaries[7].remainingAmount, -300);
    assert.equal(graph.monthlySummaries[8].remainingAmount, -1200);
    assert.equal(graph.monthlySummaries[9].budgetAmount, 48_000);
    assert.equal(graph.monthlySummaries[9].remainingAmount, 47_500);
    assert.equal(graph.monthlySummaries[10].budgetAmount, 7000);
    assert.equal(graph.monthlySummaries[10].remainingAmount, 7000);
    assert.equal((await repo.getDailyExpenses('2026-10-06')).expenses[0].id, octoberExpense.id);
    assert.equal((await repo.getDailyExpenses('2026-11-05')).expenses[0].id, novemberExpense.id);
    assert.equal((await repo.getDailyExpenses('2026-11-05')).expenses[0].budgetPeriodId,
      (await db.getFirstAsync('SELECT id FROM budget_periods WHERE label_month = ?', ['2026-10-01'])).id);
  } finally { db.close(); }
});

test('開始日を前に戻すと前月度の支出を現在月度へ移し直す', async () => {
  const db = new SqliteAdapter();
  try {
    const repo = new LocalRepository(db);
    await repo.setup(48_000, '2026-10-06');
    await repo.updateSettings({ monthlyNotificationEnabled: true, startDay: 18,
      adjustForWeekendsAndHolidays: false }, '2026-10-06');
    const expense = await repo.createExpense({ spentOn: '2026-10-16', amount: 900, memo: null });
    assert.equal((await repo.getYearlySummary(2026)).monthlySummaries[8].remainingAmount, -900);
    await repo.updateSettings({ monthlyNotificationEnabled: true, startDay: 15,
      adjustForWeekendsAndHolidays: false }, '2026-10-20');
    const october = await repo.getHome('2026-10-20');
    assert.equal(october.remainingAmount, 47_100);
    assert.equal((await repo.getYearlySummary(2026)).monthlySummaries[8].remainingAmount, 0);
    assert.equal((await repo.getDailyExpenses('2026-10-16')).expenses[0].id, expense.id);
  } finally { db.close(); }
});

test('29〜31日設定は2月の末日へ丸め、うるう年も扱う', async () => {
  for (const [year, day, expected] of [
    [2026, 29, '2026-02-28'], [2026, 30, '2026-02-28'],
    [2026, 31, '2026-02-28'], [2028, 31, '2028-02-29'],
  ]) {
    const db = new SqliteAdapter();
    try {
      const repo = new LocalRepository(db);
      await repo.setup(1000, `${year}-02-10`);
      const settings = await repo.updateSettings({ monthlyNotificationEnabled: true,
        startDay: day, adjustForWeekendsAndHolidays: false }, `${year}-02-10`);
      assert.equal(settings.nextPeriodRange.startDate, expected);
      assert.equal((await repo.getHome(expected)).budgetAmount, 1000);
    } finally { db.close(); }
  }
});

test('支出の付け替えが失敗したら期間・ルール・設定もロールバックする', async () => {
  const db = new SqliteAdapter();
  try {
    const repo = new LocalRepository(db);
    await repo.setup(48_000, '2026-10-06');
    const expense = await repo.createExpense({ spentOn: '2026-10-06', amount: 1200, memo: null });
    db.native.exec(`CREATE TRIGGER reject_reassignment BEFORE UPDATE OF budget_period_id ON expenses
      BEGIN SELECT RAISE(ABORT, 'reassignment failed'); END`);
    await assert.rejects(repo.updateSettings({ monthlyNotificationEnabled: false,
      startDay: 18, adjustForWeekendsAndHolidays: false }, '2026-10-06'), /reassignment failed/);
    assert.equal((await repo.getSettings('2026-10-06')).startDay, 1);
    assert.equal((await repo.getSettings('2026-10-06')).monthlyNotificationEnabled, true);
    assert.equal((await db.getFirstAsync('SELECT COUNT(*) AS count FROM budget_periods')).count, 1);
    assert.equal((await db.getFirstAsync('SELECT COUNT(*) AS count FROM budget_cycle_rules')).count, 1);
    assert.equal((await repo.getDailyExpenses('2026-10-06')).expenses[0].budgetPeriodId, expense.budgetPeriodId);
  } finally { db.close(); }
});

test('開始日と土日祝調整を繰り返し変更し、既存支出を新しい境界へ付け替える', async () => {
  const db = new SqliteAdapter();
  try {
    const repo = new LocalRepository(db);
    await repo.setup(48_000, '2026-10-06');
    await repo.importHolidayYear({ year: 2026, source: '検証用の年全体データ', holidays: [] });
    const enabled = await repo.updateSettings({
      monthlyNotificationEnabled: true, startDay: 18, adjustForWeekendsAndHolidays: true,
    }, '2026-10-06');
    assert.equal(enabled.startDay, 18);
    assert.equal(enabled.adjustForWeekendsAndHolidays, true);
    const disabled = await repo.updateSettings({
      monthlyNotificationEnabled: true, startDay: 18, adjustForWeekendsAndHolidays: false,
    }, '2026-10-06');
    assert.equal(disabled.adjustForWeekendsAndHolidays, false);
    const changedDay = await repo.updateSettings({
      monthlyNotificationEnabled: true, startDay: 29, adjustForWeekendsAndHolidays: false,
    }, '2026-10-06');
    assert.equal(changedDay.startDay, 29);
    assert.equal(changedDay.currentPeriodRange.endDate, '2026-10-28');
    assert.equal(changedDay.nextPeriodRange.startDate, '2026-10-29');
    assert.equal((await db.getFirstAsync('SELECT COUNT(*) AS count FROM budget_cycle_rules')).count, 1);
    assert.equal((await db.getFirstAsync('SELECT COUNT(*) AS count FROM budget_periods')).count, 2);
    await repo.createExpense({ spentOn: '2026-11-29', amount: 100, memo: null });
    const moved = await repo.updateSettings({
      monthlyNotificationEnabled: true, startDay: 30, adjustForWeekendsAndHolidays: false,
    }, '2026-10-06');
    assert.equal(moved.startDay, 30);
    assert.equal((await repo.getDailyExpenses('2026-11-29')).expenses[0].budgetPeriodId,
      (await db.getFirstAsync('SELECT id FROM budget_periods WHERE label_month = ?', ['2026-10-01'])).id);
  } finally { db.close(); }
});

test('祝日データ不足と不正入力は保存せず、後から対象年を登録できる', async () => {
  const db = new SqliteAdapter();
  try {
    const repo = new LocalRepository(db);
    await repo.setup(48_000, '2026-10-06');
    await assert.rejects(repo.updateSettings({
      monthlyNotificationEnabled: false, startDay: 18, adjustForWeekendsAndHolidays: true,
    }, '2026-10-06'), /祝日データ/);
    assert.equal((await repo.getSettings('2026-10-06')).monthlyNotificationEnabled, true);
    assert.equal((await db.getFirstAsync('SELECT COUNT(*) AS count FROM budget_cycle_rules')).count, 1);
    await repo.importHolidayYear({ year: 2026, source: '検証用の年全体データ', holidays: [] });
    const settings = await repo.updateSettings({
      monthlyNotificationEnabled: false, startDay: 18, adjustForWeekendsAndHolidays: true,
    }, '2026-10-06');
    assert.equal(settings.nextPeriodRange.startDate, '2026-10-16');
    await assert.rejects(repo.createExpense({ spentOn: '2026-10-07', amount: 0, memo: null }), /金額/);
    await assert.rejects(repo.setup(100, '2026-10-06'), /完了/);
  } finally { db.close(); }
});

test('祝日と週末で前倒しした次月度開始日に合わせ、当月度末を更新する', async () => {
  const db = new SqliteAdapter();
  try {
    const repo = new LocalRepository(db);
    await repo.setup(48_000, '2026-09-06');
    await repo.importHolidayYear({ year: 2026, source: '検証用の年全体データ', holidays: [
      { date: '2026-10-16', name: '検証用祝日' },
    ] });
    const settings = await repo.updateSettings({
      monthlyNotificationEnabled: true, startDay: 18, adjustForWeekendsAndHolidays: true,
    }, '2026-09-06');
    assert.equal(settings.currentPeriodRange.endDate, '2026-09-17');
    assert.equal(settings.nextPeriodRange.startDate, '2026-09-18');
    assert.equal(settings.nextPeriodRange.endDate, '2026-10-14');
    assert.equal((await repo.getHome('2026-10-15')).labelMonth, '2026-10-01');
    assert.equal((await repo.getHome('2026-10-14')).labelMonth, '2026-09-01');
  } finally { db.close(); }
});

test('公表済み祝日をオフラインDBに重複なく投入する', async () => {
  const db = new SqliteAdapter();
  try {
    await seedBundledHolidays(db);
    await seedBundledHolidays(db);
    const years = await db.getAllAsync('SELECT calendar_year FROM holiday_calendar_coverage ORDER BY calendar_year');
    assert.deepEqual(years.map(row => row.calendar_year), [2025, 2026, 2027]);
    const counts = await db.getAllAsync('SELECT calendar_year, COUNT(*) AS total FROM holidays GROUP BY calendar_year ORDER BY calendar_year');
    assert.deepEqual(counts.map(row => row.total), [19, 18, 17]);
    assert.equal((await db.getFirstAsync('SELECT name FROM holidays WHERE holiday_date = ?', ['2026-09-22'])).name, '休日');
  } finally { db.close(); }
});

test('each month starts at zero and changing one month does not change another', async () => {
  const db = new SqliteAdapter();
  try {
    const repo = new LocalRepository(db);
    await repo.setup(48_000, '2026-10-06');
    assert.equal((await repo.getCurrentBudget('2026-09-15')).budgetAmount, 0);
    assert.equal((await repo.getCurrentBudget('2026-11-06')).budgetAmount, 0);
    await repo.updateCurrentBudget(12_000, '2026-11-06');
    const yearly = await repo.getYearlySummary(2026);
    assert.equal(yearly.monthlySummaries[8].budgetAmount, 0);
    assert.equal(yearly.monthlySummaries[9].budgetAmount, 48_000);
    assert.equal(yearly.monthlySummaries[10].budgetAmount, 12_000);
    await repo.updateCurrentBudget(9_000, '2026-09-15');
    assert.equal((await repo.getYearlySummary(2026)).monthlySummaries[10].budgetAmount, 12_000);
  } finally { db.close(); }
});

test('calendar totals include dates in the next calendar month within the same budget period', async () => {
  const db = new SqliteAdapter();
  try {
    const repo = new LocalRepository(db);
    await repo.setup(48_000, '2026-09-06');
    await repo.updateSettings({ monthlyNotificationEnabled: true, startDay: 18, adjustForWeekendsAndHolidays: false }, '2026-09-06');
    await repo.createExpense({ spentOn: '2026-10-18', amount: 500, memo: null });
    await repo.createExpense({ spentOn: '2026-11-10', amount: 900, memo: null });
    const october = await repo.getMonthlyCalendar('2026-10');
    assert.equal(october.periodStart, '2026-10-18');
    assert.equal(october.periodEnd, '2026-11-17');
    assert.deepEqual(october.dailyTotals, [
      { date: '2026-10-18', totalAmount: 500 },
      { date: '2026-11-10', totalAmount: 900 },
    ]);
    assert.equal((await repo.getYearlySummary(2026)).monthlySummaries[9].spentAmount, 1400);
  } finally { db.close(); }
});

test('December 2026 and later calendar months are provisioned by label after changing the start day', async () => {
  const db = new SqliteAdapter();
  try {
    const repo = new LocalRepository(db);
    await repo.setup(48_000, '2026-10-07');
    await repo.updateSettings({
      monthlyNotificationEnabled: true, startDay: 8, adjustForWeekendsAndHolidays: false,
    }, '2026-10-07');
    const december = await repo.getMonthlyCalendar('2026-12');
    assert.equal(december.periodStart, '2026-12-08');
    assert.equal(december.periodEnd, '2027-01-07');
    assert.equal((await db.getFirstAsync('SELECT budget_amount FROM budget_periods WHERE label_month = ?', ['2026-12-01'])).budget_amount, 0);
    assert.equal((await repo.getMonthlyCalendar('2030-12')).month, '2030-12');
  } finally { db.close(); }
});

test('新規DBは移行v1〜v5を一度ずつ適用し、再起動でもデータを保持する', async () => {
  assert.deepEqual(migrations.map(migration => migration.version), [1, 2, 3, 4, 5]);
  const db = new SqliteAdapter(false);
  try {
    await initializeDatabase(db);
    assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, 5);
    const repo = new LocalRepository(db);
    await repo.setup(30_000, '2026-10-06');
    await repo.createExpense({ spentOn: '2026-10-06', amount: 1_200, memo: '検証用' });
    const before = await db.getFirstAsync('SELECT COUNT(*) AS count, SUM(amount) AS amount FROM expenses');
    await initializeDatabase(db);
    assert.deepEqual(await db.getFirstAsync('SELECT COUNT(*) AS count, SUM(amount) AS amount FROM expenses'), before);
    assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, 5);
    assert.equal((await db.getAllAsync('PRAGMA foreign_key_check')).length, 0);
  } finally { db.close(); }
});

test('旧v1 DBの更新は予算・支出・参照関係を保持し、v2を一度だけ適用する', async () => {
  const db = new SqliteAdapter(false);
  try {
    await db.execAsync(migrations[0].sql);
    await db.execAsync('PRAGMA user_version = 1');
    const now = '2026-10-06T00:00:00.000Z';
    const ruleId = randomUUID();
    const periodId = randomUUID();
    const expenseId = randomUUID();
    await db.runAsync('INSERT INTO app_settings (id, created_at, updated_at) VALUES (1, ?, ?)', [now, now]);
    await db.runAsync('INSERT INTO budget_cycle_rules (id, start_day, effective_from, created_at, updated_at) VALUES (?, 1, ?, ?, ?)',
      [ruleId, '2026-10-01', now, now]);
    await db.runAsync('INSERT INTO budget_periods (id, cycle_rule_id, label_month, start_date, nominal_end_date, end_date, budget_amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [periodId, ruleId, '2026-10-01', '2026-10-01', '2026-10-31', '2026-10-31', 30_000, now, now]);
    await db.runAsync('INSERT INTO expenses (id, budget_period_id, spent_on, amount, memo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [expenseId, periodId, '2026-10-06', 1_200, '検証用', now, now]);
    const before = await db.getFirstAsync('SELECT COUNT(*) AS count, SUM(amount) AS amount FROM expenses');

    await initializeDatabase(db);

    assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, 5);
    assert.deepEqual(await db.getFirstAsync('SELECT COUNT(*) AS count, SUM(amount) AS amount FROM expenses'), before);
    assert.deepEqual({ ...await db.getFirstAsync('SELECT budget_amount, budget_configured FROM budget_periods WHERE id = ?', [periodId]) },
      { budget_amount: 30_000, budget_configured: 1 });
    assert.deepEqual({ ...await db.getFirstAsync('SELECT budget_period_id, memo FROM expenses WHERE id = ?', [expenseId]) },
      { budget_period_id: periodId, memo: '検証用' });
    assert.equal((await db.getAllAsync('PRAGMA foreign_key_check')).length, 0);
  } finally { db.close(); }
});

test('V1 migration clears inherited budgets but preserves the setup and edited months', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('PRAGMA foreign_keys = ON');
    db.exec(migrations[0].sql);
    const setupTime = '2026-10-06T00:00:00.000Z';
    const laterTime = '2026-11-06T00:00:00.000Z';
    const ruleId = randomUUID();
    db.prepare('INSERT INTO app_settings (id, created_at, updated_at) VALUES (1, ?, ?)').run(setupTime, setupTime);
    db.prepare('INSERT INTO budget_cycle_rules (id, start_day, adjust_for_weekends_and_holidays, effective_from, created_at, updated_at) VALUES (?, 1, 0, ?, ?, ?)').run(ruleId, '2026-09-01', setupTime, setupTime);
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    const insert = db.prepare('INSERT INTO budget_periods (id, cycle_rule_id, label_month, start_date, nominal_end_date, end_date, budget_amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    insert.run(ids[0], ruleId, '2026-09-01', '2026-09-01', '2026-09-30', '2026-09-30', 48_000, laterTime, laterTime);
    insert.run(ids[1], ruleId, '2026-10-01', '2026-10-01', '2026-10-31', '2026-10-31', 48_000, setupTime, setupTime);
    insert.run(ids[2], ruleId, '2026-11-01', '2026-11-01', '2026-11-30', '2026-11-30', 12_000, laterTime, '2026-11-07T00:00:00.000Z');
    const expenseId = randomUUID();
    db.prepare('INSERT INTO expenses (id, budget_period_id, spent_on, amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(expenseId, ids[0], '2026-09-15', 900, laterTime, laterTime);
    db.exec('BEGIN IMMEDIATE');
    try { db.exec(migrations[1].sql); db.exec('COMMIT'); }
    catch (error) { db.exec('ROLLBACK'); throw error; }
    const amounts = db.prepare('SELECT budget_amount FROM budget_periods ORDER BY label_month').all().map(row => row.budget_amount);
    assert.deepEqual(amounts, [0, 48_000, 12_000]);
    assert.equal(db.prepare('SELECT remaining_amount FROM budget_period_summary WHERE label_month = ?').get('2026-09-01').remaining_amount, -900);
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
    assert.throws(() => db.prepare('UPDATE budget_periods SET budget_amount = -1 WHERE id = ?').run(ids[0]));
  } finally { db.close(); }
});

test('設定・月度・予算・支出を1つのバージョン付きJSONへ保存して復元する', async () => {
  const db = new SqliteAdapter();
  try {
    const repo = new LocalRepository(db);
    await repo.setup(48_000, '2026-10-06');
    await repo.updateSettings({ monthlyNotificationEnabled: false, startDay: 8,
      adjustForWeekendsAndHolidays: false }, '2026-10-06');
    const expense = await repo.createExpense({ spentOn: '2026-10-07', amount: 1200, memo: '昼食' });
    const json = await repo.createBackupJson();
    const backup = JSON.parse(json);
    assert.equal(backup.format, 'zubora-kakeibo-backup');
    assert.equal(backup.version, 2);
    assert.equal(backup.data.settings.length, 1);
    assert.ok(backup.data.cycleRules.length >= 1);
    assert.ok(backup.data.budgetPeriods.length >= 1);
    assert.equal(backup.data.expenses[0].id, expense.id);

    await repo.updateCurrentBudget(99_000, '2026-10-09');
    await repo.createExpense({ spentOn: '2026-10-09', amount: 3000, memo: null });
    await repo.restoreBackupJson(json);

    const settings = await repo.getSettings('2026-10-07');
    assert.equal(settings.startDay, 8);
    assert.equal(settings.monthlyNotificationEnabled, false);
    assert.equal((await repo.getCurrentBudget('2026-10-08')).budgetAmount, 48_000);
    const restored = await repo.getDailyExpenses('2026-10-07');
    assert.equal(restored.expenses.length, 1);
    assert.equal(restored.expenses[0].id, expense.id);
    assert.equal((await repo.getDailyExpenses('2026-10-09')).expenses.length, 0);
  } finally { db.close(); }
});

test('参照関係が壊れたバックアップをDB更新前に拒否する', async () => {
  const db = new SqliteAdapter();
  try {
    const repo = new LocalRepository(db);
    await repo.setup(48_000, '2026-10-06');
    const expense = await repo.createExpense({ spentOn: '2026-10-06', amount: 1200, memo: null });
    const backup = JSON.parse(await repo.createBackupJson());
    backup.data.expenses[0].budget_period_id = randomUUID();
    await assert.rejects(repo.restoreBackupJson(JSON.stringify(backup)), /存在しない月度/);
    assert.equal((await repo.getDailyExpenses('2026-10-06')).expenses[0].id, expense.id);
    assert.equal((await repo.getHome('2026-10-06')).remainingAmount, 46_800);
  } finally { db.close(); }
});

test('復元途中に失敗した場合は現在データを全てロールバックする', async () => {
  const db = new SqliteAdapter();
  try {
    const repo = new LocalRepository(db);
    await repo.setup(48_000, '2026-10-06');
    await repo.createExpense({ spentOn: '2026-10-06', amount: 1200, memo: '復元対象' });
    const backup = await repo.createBackupJson();
    await repo.updateCurrentBudget(75_000, '2026-10-06');
    db.native.exec(`CREATE TRIGGER reject_restore BEFORE INSERT ON expenses
      BEGIN SELECT RAISE(ABORT, 'restore failed'); END`);

    await assert.rejects(repo.restoreBackupJson(backup), /restore failed/);
    assert.equal((await repo.getCurrentBudget('2026-10-06')).budgetAmount, 75_000);
    assert.equal((await repo.getDailyExpenses('2026-10-06')).expenses[0].memo, '復元対象');
    assert.equal((await db.getFirstAsync('SELECT COUNT(*) AS count FROM app_settings')).count, 1);
  } finally { db.close(); }
});

test('初期設定前の新しい端末DBへバックアップを復元できる', async () => {
  const sourceDb = new SqliteAdapter();
  const destinationDb = new SqliteAdapter();
  try {
    const source = new LocalRepository(sourceDb);
    const destination = new LocalRepository(destinationDb);
    await source.setup(32_000, '2026-10-06');
    const expense = await source.createExpense({ spentOn: '2026-10-06', amount: 680, memo: 'お茶' });
    assert.equal(await destination.isInitialized(), false);
    await destination.restoreBackupJson(await source.createBackupJson());
    assert.equal(await destination.isInitialized(), true);
    assert.equal((await destination.getHome('2026-10-06')).remainingAmount, 31_320);
    assert.equal((await destination.getDailyExpenses('2026-10-06')).expenses[0].id, expense.id);
  } finally { sourceDb.close(); destinationDb.close(); }
});

test('空白メモは既存DBの値を変えずに復元する', async () => {
  const db = new SqliteAdapter();
  try {
    const repo = new LocalRepository(db);
    await repo.setup(1_000, '2026-10-06');
    const expense = await repo.createExpense({ spentOn: '2026-10-06', amount: 100, memo: null });
    await db.runAsync('UPDATE expenses SET memo = ? WHERE id = ?', ['', expense.id]);
    const json = await repo.createBackupJson();
    await repo.restoreBackupJson(json);
    assert.equal((await repo.getDailyExpenses('2026-10-06')).expenses[0].memo, '');
  } finally { db.close(); }
});

test('60か月・支出1万件の集計とバックアップ復元で件数・金額を維持する', async () => {
  const sourceDb = new SqliteAdapter();
  const destinationDb = new SqliteAdapter();
  try {
    const source = new LocalRepository(sourceDb);
    const destination = new LocalRepository(destinationDb);
    await source.setup(100_000, '2026-01-15');
    for (let year = 2026; year <= 2030; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        await source.getMonthlyCalendar(`${year}-${String(month).padStart(2, '0')}`);
      }
    }
    const periods = sourceDb.native.prepare('SELECT id, start_date FROM budget_periods ORDER BY label_month').all();
    assert.equal(periods.length, 60);
    const insert = sourceDb.native.prepare(`INSERT INTO expenses
      (id, budget_period_id, spent_on, amount, memo, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    const stamp = '2026-01-15T00:00:00.000Z';
    sourceDb.native.exec('BEGIN IMMEDIATE');
    try {
      for (let index = 0; index < 10_000; index += 1) {
        const period = periods[index % periods.length];
        insert.run(randomUUID(), period.id, period.start_date, 1, index % 2 ? null : 'テスト', stamp, stamp);
      }
      sourceDb.native.exec('COMMIT');
    } catch (error) {
      sourceDb.native.exec('ROLLBACK');
      throw error;
    }
    const json = await source.createBackupJson();
    assert.equal(JSON.parse(json).data.expenses.length, 10_000);
    await destination.restoreBackupJson(json);
    const totals = destinationDb.native.prepare('SELECT COUNT(*) AS count, SUM(amount) AS total FROM expenses').get();
    assert.equal(totals.count, 10_000);
    assert.equal(totals.total, 10_000);
    assert.equal(destinationDb.native.prepare('SELECT COUNT(*) AS count FROM budget_periods').get().count, 60);
    assert.equal(destinationDb.native.prepare('PRAGMA foreign_key_check').all().length, 0);
    assert.equal((await destination.getMonthlyCalendar('2026-01')).dailyTotals[0].totalAmount, 167);
  } finally { sourceDb.close(); destinationDb.close(); }
});
