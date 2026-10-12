import assert from 'node:assert/strict';
import test from 'node:test';

import { calculatePeriod, EMPTY_HOLIDAY_CALENDAR } from './period.ts';

const rule = (startDay, adjustForWeekendsAndHolidays = false) => ({ startDay, adjustForWeekendsAndHolidays });

test('月末にない開始日は平年・うるう年の月末へ丸める', () => {
  assert.deepEqual(calculatePeriod('2026-02', rule(31), rule(31), EMPTY_HOLIDAY_CALENDAR), {
    labelMonth: '2026-02-01', startDate: '2026-02-28', nominalEndDate: '2026-03-30', endDate: '2026-03-30',
  });
  assert.equal(calculatePeriod('2028-02', rule(31), rule(31), EMPTY_HOLIDAY_CALENDAR).startDate, '2028-02-29');
  assert.equal(calculatePeriod('2026-04', rule(31), rule(31), EMPTY_HOLIDAY_CALENDAR).startDate, '2026-04-30');
});

test('土日祝の前倒し後も月度は隣接する', () => {
  const calendar = { coveredYears: new Set([2026]), holidayDates: new Set(['2026-10-16']) };
  const september = calculatePeriod('2026-09', rule(18, true), rule(18, true), calendar);
  const october = calculatePeriod('2026-10', rule(18, true), rule(18, true), calendar);
  assert.equal(september.endDate, '2026-10-14');
  assert.equal(october.startDate, '2026-10-15');
});

test('次月度の新ルールで当月度の終了日を決める', () => {
  const september = calculatePeriod('2026-09', rule(18), rule(25), EMPTY_HOLIDAY_CALENDAR);
  const october = calculatePeriod('2026-10', rule(25), rule(25), EMPTY_HOLIDAY_CALENDAR);
  assert.equal(september.endDate, '2026-10-24');
  assert.equal(october.startDate, '2026-10-25');
});

test('祝日coverage不足・範囲逆転・不正な開始日を拒否する', () => {
  assert.throws(() => calculatePeriod('2026-09', rule(18, true), rule(18, true), EMPTY_HOLIDAY_CALENDAR), /祝日データ/);
  assert.throws(() => calculatePeriod('2026-01', rule(31), rule(1, true), {
    coveredYears: new Set([2026]), holidayDates: new Set(),
  }), /終了日/);
  assert.throws(() => calculatePeriod('2026-09', rule(32), rule(32), EMPTY_HOLIDAY_CALENDAR), /1〜31/);
});

test('2028年以降の未収録年は土日だけ調整し、年全体の祝日登録後は祝日も反映する', () => {
  const missing = calculatePeriod('2028-04', rule(3, true), rule(3, true), EMPTY_HOLIDAY_CALENDAR);
  assert.deepEqual(missing, {
    labelMonth: '2028-04-01', startDate: '2028-04-03', nominalEndDate: '2028-05-02', endDate: '2028-05-02',
  });
  const imported = calculatePeriod('2028-04', rule(3, true), rule(3, true), {
    coveredYears: new Set([2028]), holidayDates: new Set(['2028-04-03']),
  });
  assert.equal(imported.startDate, '2028-03-31');
  const future = calculatePeriod('2030-06', rule(1, true), rule(1, true), EMPTY_HOLIDAY_CALENDAR);
  assert.equal(future.startDate, '2030-05-31');
  assert.equal(future.endDate, '2030-06-30');
});
