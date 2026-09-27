import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertExpenseDateWithinPeriod,
  assertNoBudgetPeriodOverlap,
  calculateBudgetPeriod,
  planCycleRuleChange,
} from '../src/domain/budget-periods.js'

const coverage2026 = { start: '2026-01-01', end: '2026-12-31' }

test('1日から月末までの期間を生成する', () => {
  assert.deepEqual(calculateBudgetPeriod({
    labelMonth: '2026-09-01',
    startDay: 1,
    adjustForWeekendsAndHolidays: false,
  }), {
    labelMonth: '2026-09-01',
    startDate: '2026-09-01',
    nominalEndDate: '2026-09-30',
    endDate: '2026-09-30',
  })
})

test('25日開始なら翌月24日までの月度を生成する', () => {
  assert.deepEqual(calculateBudgetPeriod({
    labelMonth: '2026-09-01',
    startDay: 25,
    adjustForWeekendsAndHolidays: false,
  }), {
    labelMonth: '2026-09-01',
    startDate: '2026-09-25',
    nominalEndDate: '2026-10-24',
    endDate: '2026-10-24',
  })
})

test('うるう年の月末を扱う', () => {
  assert.equal(calculateBudgetPeriod({
    labelMonth: '2028-02-01',
    startDay: 1,
    adjustForWeekendsAndHolidays: false,
  }).endDate, '2028-02-29')
})

test('土日祝なら月度の開始日を直前の平日に調整し、次月度前日で終了する', () => {
  assert.deepEqual(calculateBudgetPeriod({
    labelMonth: '2026-09-01',
    startDay: 25,
    adjustForWeekendsAndHolidays: true,
    holidayDates: [],
    holidayCoverage: coverage2026,
  }), {
    labelMonth: '2026-09-01',
    startDate: '2026-09-25',
    nominalEndDate: '2026-10-24',
    endDate: '2026-10-22',
  })
})

test('前月度の終了日は次月度の調整済み開始日の前日になる', () => {
  assert.deepEqual(calculateBudgetPeriod({
    labelMonth: '2026-10-01',
    startDay: 18,
    adjustForWeekendsAndHolidays: true,
    holidayCoverage: coverage2026,
  }), {
    labelMonth: '2026-10-01',
    startDate: '2026-10-16',
    nominalEndDate: '2026-11-17',
    endDate: '2026-11-17',
  })
})

test('31日開始は存在しない月で月末へ丸める', () => {
  assert.deepEqual(calculateBudgetPeriod({
    labelMonth: '2026-01-01',
    startDay: 31,
    adjustForWeekendsAndHolidays: false,
  }), {
    labelMonth: '2026-01-01',
    startDate: '2026-01-31',
    nominalEndDate: '2026-02-27',
    endDate: '2026-02-27',
  })
  assert.deepEqual(calculateBudgetPeriod({
    labelMonth: '2026-02-01',
    startDay: 31,
    adjustForWeekendsAndHolidays: false,
  }), {
    labelMonth: '2026-02-01',
    startDate: '2026-02-28',
    nominalEndDate: '2026-03-30',
    endDate: '2026-03-30',
  })
})

test('31日開始はうるう年の2月を29日へ丸める', () => {
  assert.deepEqual(calculateBudgetPeriod({
    labelMonth: '2028-02-01',
    startDay: 31,
    adjustForWeekendsAndHolidays: false,
  }), {
    labelMonth: '2028-02-01',
    startDate: '2028-02-29',
    nominalEndDate: '2028-03-30',
    endDate: '2028-03-30',
  })
})

test('31日開始で月末が休日なら開始日を直前の平日へ調整する', () => {
  assert.deepEqual(calculateBudgetPeriod({
    labelMonth: '2026-02-01',
    startDay: 31,
    adjustForWeekendsAndHolidays: true,
    holidayCoverage: coverage2026,
  }), {
    labelMonth: '2026-02-01',
    startDate: '2026-02-27',
    nominalEndDate: '2026-03-30',
    endDate: '2026-03-30',
  })
})

test('32日開始は拒否する', () => {
  assert.throws(() => calculateBudgetPeriod({
    labelMonth: '2026-09-01',
    startDay: 32,
    adjustForWeekendsAndHolidays: false,
  }), /1〜31/)
})

test('祝日データの対象期間が不足している場合は拒否する', () => {
  assert.throws(() => calculateBudgetPeriod({
    labelMonth: '2026-09-01',
    startDay: 1,
    adjustForWeekendsAndHolidays: true,
    holidayCoverage: { start: '2025-01-01', end: '2025-12-31' },
  }), /祝日データが不足/)
})

test('支出日が期間外の場合は拒否する', () => {
  const period = { startDate: '2026-09-01', endDate: '2026-09-30' }
  assert.doesNotThrow(() => assertExpenseDateWithinPeriod('2026-09-30', period))
  assert.throws(() => assertExpenseDateWithinPeriod('2026-10-01', period), /予算期間内/)
})

test('既存の予算期間と重複する期間を拒否する', () => {
  const existing = [{ startDate: '2026-09-01', endDate: '2026-09-30' }]
  assert.doesNotThrow(() => assertNoBudgetPeriodOverlap(
    { startDate: '2026-10-01', endDate: '2026-10-31' },
    existing,
  ))
  assert.throws(() => assertNoBudgetPeriodOverlap(
    { startDate: '2026-09-30', endDate: '2026-10-30' },
    existing,
  ), /重複/)
})

test('期間設定の変更は次の期間から適用する', () => {
  const currentRule = {
    id: '11111111-1111-4111-8111-111111111111',
    effectiveFrom: '2026-09-01',
    startDay: 1,
  }
  const result = planCycleRuleChange({
    currentRule,
    nextPeriodStart: '2026-10-01',
    nextRule: { startDay: 25, adjustForWeekendsAndHolidays: true },
    nextRuleId: '22222222-2222-4222-8222-222222222222',
    now: '2026-09-22T00:00:00.000Z',
  })

  assert.equal(result.currentRuleUpdate.effectiveTo, '2026-09-30')
  assert.equal(result.newRule.effectiveFrom, '2026-10-01')
  assert.equal(currentRule.effectiveFrom, '2026-09-01')
})
