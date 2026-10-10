import type { IsoDate, PeriodRange, YearMonth } from '../domain/period';

export type Expense = {
  id: string;
  budgetPeriodId: string;
  spentOn: IsoDate;
  amount: number;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseInput = Pick<Expense, 'spentOn' | 'amount' | 'memo'>;
export type SettingsInput = {
  monthlyNotificationEnabled: boolean;
  startDay: number;
  adjustForWeekendsAndHolidays: boolean;
};

export type Settings = SettingsInput & {
  timezone: string;
  currentBudgetAmount: number;
  currentBudgetConfigured: boolean;
  previousPeriodRange: PeriodRange;
  currentPeriodRange: PeriodRange;
  nextPeriodRange: PeriodRange;
};

export type Budget = {
  budgetPeriodId: string;
  labelMonth: IsoDate;
  budgetAmount: number;
  remainingAmount: number;
  updatedAt: string;
};

export type Home = {
  labelMonth: IsoDate;
  budgetAmount: number;
  spentAmount: number;
  remainingAmount: number;
  todayExpense: number;
  remainingDays: number;
  message: string;
};

export type CalendarMonth = {
  month: YearMonth;
  periodStart: IsoDate;
  periodEnd: IsoDate;
  dailyTotals: { date: IsoDate; totalAmount: number }[];
};

export type DailyExpenses = { date: IsoDate; totalAmount: number; expenses: Expense[] };

export type MonthlyBudgetSummary = {
  month: number;
  budgetAmount: number;
  spentAmount: number;
  remainingAmount: number;
  expenseCount: number;
};

export type YearlyBudgetSummary = {
  year: number;
  availableYears: number[];
  monthlySummaries: MonthlyBudgetSummary[];
};

export type HolidayYear = {
  year: number;
  source: string;
  holidays: { date: IsoDate; name: string }[];
};
