export type HomeViewModel = {
  month: number
  remainingBudget: number
  remainingDays: number
  todayExpense: number
  message: string
}

export type ExpenseDraft = { amount: string; memo: string }
