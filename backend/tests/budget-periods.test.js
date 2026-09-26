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
    closingDay: null,
    adjustForWeekendsAndHolidays: false,
  }), {
    labelMonth: '2026-09-01',
    startDate: '2026-09-01',
    nominalEndDate: '2026-09-30',
    endDate: '2026-09-30',
  })
})

test('月をまたぐ25日から翌月24日までの期間を生成する', () => {
  assert.equal(calculateBudgetPeriod({
    labelMonth: '2026-09-01',
    startDay: 25,
    closingDay: 24,
    adjustForWeekendsAndHolidays: false,
  }).startDate, '2026-08-25')
})

test('うるう年の月末を扱う', () => {
  assert.equal(calculateBudgetPeriod({
    labelMonth: '2028-02-01',
    startDay: 1,
    closingDay: null,
    adjustForWeekendsAndHolidays: false,
  }).endDate, '2028-02-29')
})

test('土日祝なら直前の平日に締め日を調整する', () => {
  assert.equal(calculateBudgetPeriod({
    labelMonth: '2026-09-01',
    startDay: 1,
    closingDay: 23,
    adjustForWeekendsAndHolidays: true,
    holidayDates: ['2026-09-23', '2026-09-22'],
    holidayCoverage: coverage2026,
  }).endDate, '2026-09-21')
})

test('祝日データの対象期間が不足している場合は拒否する', () => {
  assert.throws(() => calculateBudgetPeriod({
    labelMonth: '2026-09-01',
    startDay: 1,
    closingDay: null,
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
    closingDay: null,
  }
  const result = planCycleRuleChange({
    currentRule,
    nextPeriodStart: '2026-10-01',
    nextRule: { startDay: 25, closingDay: 24, adjustForWeekendsAndHolidays: true },
    nextRuleId: '22222222-2222-4222-8222-222222222222',
    now: '2026-09-22T00:00:00.000Z',
  })

  assert.equal(result.currentRuleUpdate.effectiveTo, '2026-09-30')
  assert.equal(result.newRule.effectiveFrom, '2026-10-01')
  assert.equal(currentRule.effectiveFrom, '2026-09-01')
})
