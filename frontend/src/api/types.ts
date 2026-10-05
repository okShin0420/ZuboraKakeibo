export type IsoDate = string
export type YearMonth = string

export type HomeResponse = {
  labelMonth: IsoDate
  budgetAmount: number
  spentAmount: number
  remainingAmount: number
  todayExpense: number
  remainingDays: number
  message: string
}

export type ExpenseResponse = {
  id: string
  budgetPeriodId: string
  spentOn: IsoDate
  amount: number
  memo: string | null
  createdAt: string
  updatedAt: string
}

export type ExpenseRequest = { spentOn: IsoDate; amount: number; memo: string | null }
export type DailyExpenseTotal = { date: IsoDate; totalAmount: number }
export type CalendarMonthResponse = {
  month: YearMonth
  periodStart: IsoDate
  periodEnd: IsoDate
  dailyTotals: DailyExpenseTotal[]
}
export type DailyExpensesResponse = { date: IsoDate; totalAmount: number; expenses: ExpenseResponse[] }
export type MonthlyBudgetSummary = {
  month: number
  budgetAmount: number
  spentAmount: number
  remainingAmount: number
  expenseCount: number
}
export type YearlyBudgetSummaryResponse = {
  year: number
  availableYears: number[]
  monthlySummaries: MonthlyBudgetSummary[]
}
export type PeriodRangeResponse = { labelMonth: IsoDate; startDate: IsoDate; endDate: IsoDate }
export type SettingsResponse = {
  monthlyNotificationEnabled: boolean
  timezone: string
  startDay: number
  adjustForWeekendsAndHolidays: boolean
  currentBudgetAmount: number
  currentPeriodRange: PeriodRangeResponse
  nextPeriodRange: PeriodRangeResponse
}
export type UpdateSettingsRequest = Pick<SettingsResponse, 'monthlyNotificationEnabled' | 'startDay' | 'adjustForWeekendsAndHolidays'>
export type BudgetResponse = {
  budgetPeriodId: string
  labelMonth: IsoDate
  budgetAmount: number
  remainingAmount: number
  updatedAt: string
}
export type ErrorResponse = {
  code: string
  message: string
  fieldErrors: Record<string, string>
  timestamp: string
}
export type SetupStatusResponse = { initialized: boolean }
