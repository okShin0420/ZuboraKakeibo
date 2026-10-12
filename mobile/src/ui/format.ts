import { addDays, addMonths, daysBetween, parseIsoDate } from '../domain/period';

export const yen = (value: number): string => Math.round(value).toLocaleString('ja-JP');
export const todayInTokyo = (): string => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
export const monthLabel = (value: string): string => `${Number(value.slice(5, 7))}月`;
export const yearMonthLabel = (value: string): string => `${Number(value.slice(0, 4))}年${Number(value.slice(5, 7))}月`;
export const rangeLabel = (start: string, end: string): string =>
  `${Number(start.slice(5, 7))}月${Number(start.slice(8, 10))}日〜${Number(end.slice(5, 7))}月${Number(end.slice(8, 10))}日`;

export function calendarCells(month: string): Array<number | null> {
  const first = parseIsoDate(`${month}-01`);
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const next = parseIsoDate(`${addMonths(month, 1)}-01`);
  next.setUTCDate(0);
  return [
    ...Array.from({ length: mondayOffset }, () => null),
    ...Array.from({ length: next.getUTCDate() }, (_, index) => index + 1),
  ];
}

export function periodCalendarCells(start: string, end: string): Array<string | null> {
  const mondayOffset = (parseIsoDate(start).getUTCDay() + 6) % 7;
  const dates = Array.from({ length: daysBetween(start, end) + 1 }, (_, index) => addDays(start, index));
  const cells: Array<string | null> = [...Array.from({ length: mondayOffset }, () => null), ...dates];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
