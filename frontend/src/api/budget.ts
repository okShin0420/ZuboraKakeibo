import { apiRequest } from './client'
import type { BudgetResponse, IsoDate } from './types'

export const getCurrentBudget = (asOf: IsoDate) =>
  apiRequest<BudgetResponse>(`/budgets/current?asOf=${encodeURIComponent(asOf)}`)

export const updateCurrentBudget = (asOf: IsoDate, amount: number) =>
  apiRequest<BudgetResponse>('/budgets/current', { method: 'PUT', body: JSON.stringify({ asOf, amount }) })
