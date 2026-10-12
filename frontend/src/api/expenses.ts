import { apiRequest } from './client'
import type { ExpenseRequest, ExpenseResponse } from './types'

export const createExpense = (request: ExpenseRequest) =>
  apiRequest<ExpenseResponse>('/expenses', { method: 'POST', body: JSON.stringify(request) })

export const updateExpense = (id: string, request: ExpenseRequest) =>
  apiRequest<ExpenseResponse>(`/expenses/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(request) })

export const deleteExpense = (id: string) =>
  apiRequest<void>(`/expenses/${encodeURIComponent(id)}`, { method: 'DELETE' })
