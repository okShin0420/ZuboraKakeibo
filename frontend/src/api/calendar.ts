import { apiRequest } from './client'
import type { CalendarMonthResponse, DailyExpensesResponse, IsoDate, YearMonth } from './types'

export const getCalendarMonth = (month: YearMonth) =>
  apiRequest<CalendarMonthResponse>(`/calendar?month=${encodeURIComponent(month)}`)

export const getDailyExpenses = (date: IsoDate) =>
  apiRequest<DailyExpensesResponse>(`/calendar/days/${encodeURIComponent(date)}`)
