import { apiRequest } from './client'
import type { YearlyBudgetSummaryResponse } from './types'

export const getYearlySummary = (year: number) =>
  apiRequest<YearlyBudgetSummaryResponse>(`/graphs/yearly?year=${year}`)
