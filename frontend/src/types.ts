export type HomeViewModel = {
  month: number
  budgetAmount: number
  remainingBudget: number
  remainingDays: number
  todayExpense: number
  message: string
}

export type ExpenseDraft = { amount: string; memo: string }
