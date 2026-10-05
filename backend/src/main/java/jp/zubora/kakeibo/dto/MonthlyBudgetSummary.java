package jp.zubora.kakeibo.dto;

public record MonthlyBudgetSummary(
        int month,
        long budgetAmount,
        long spentAmount,
        long remainingAmount,
        long expenseCount
) {
}
