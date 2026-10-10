export type IsoDate = string;
export type YearMonth = string;

export type CycleRule = {
  startDay: number;
  adjustForWeekendsAndHolidays: boolean;
};

export type PeriodRange = {
  labelMonth: IsoDate;
  startDate: IsoDate;
  nominalEndDate: IsoDate;
  endDate: IsoDate;
};

export type HolidayCalendar = {
  coveredYears: ReadonlySet<number>;
  holidayDates: ReadonlySet<IsoDate>;
};

export function parseIsoDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('日付はYYYY-MM-DD形式で指定してください');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('実在する日付を指定してください');
  }
  return date;
}

export function toIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function addDays(value: IsoDate, days: number): IsoDate {
  const date = parseIsoDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

export function addMonths(value: YearMonth, months: number): YearMonth {
  if (!/^\d{4}-\d{2}$/.test(value)) throw new Error('月はYYYY-MM形式で指定してください');
  const date = parseIsoDate(`${value}-01`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return toIsoDate(date).slice(0, 7);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / 86_400_000);
}

export function scheduledStart(month: YearMonth, startDay: number): IsoDate {
  validateRule({ startDay, adjustForWeekendsAndHolidays: false });
  const first = parseIsoDate(`${month}-01`);
  const lastDay = new Date(first.getTime());
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1);
  lastDay.setUTCDate(0);
  first.setUTCDate(Math.min(startDay, lastDay.getUTCDate()));
  return toIsoDate(first);
}

function validateRule(rule: CycleRule): void {
  if (!Number.isInteger(rule.startDay) || rule.startDay < 1 || rule.startDay > 31) {
    throw new Error('月度の開始日は1〜31日で指定してください');
  }
}

function adjustedStart(scheduled: IsoDate, rule: CycleRule, calendar: HolidayCalendar): IsoDate {
  if (!rule.adjustForWeekendsAndHolidays) return scheduled;
  let date = scheduled;
  while (true) {
    const year = Number(date.slice(0, 4));
    if (!calendar.coveredYears.has(year) && year < 2028) {
      throw new Error(`月度開始日の祝日データが不足しています: ${year}`);
    }
    const dayOfWeek = parseIsoDate(date).getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !calendar.holidayDates.has(date)) return date;
    date = addDays(date, -1);
  }
}

export function calculatePeriod(
  month: YearMonth,
  currentRule: CycleRule,
  nextRule: CycleRule,
  calendar: HolidayCalendar,
): PeriodRange {
  validateRule(currentRule);
  validateRule(nextRule);
  const labelMonth = `${month}-01`;
  parseIsoDate(labelMonth);
  const startDate = adjustedStart(scheduledStart(month, currentRule.startDay), currentRule, calendar);
  const nextScheduledStart = scheduledStart(addMonths(month, 1), nextRule.startDay);
  const nominalEndDate = addDays(nextScheduledStart, -1);
  const endDate = addDays(adjustedStart(nextScheduledStart, nextRule, calendar), -1);
  if (endDate < startDate) throw new Error('調整後の月度終了日が開始日より前になります');
  return { labelMonth, startDate, nominalEndDate, endDate };
}

export const EMPTY_HOLIDAY_CALENDAR: HolidayCalendar = {
  coveredYears: new Set<number>(),
  holidayDates: new Set<IsoDate>(),
};
