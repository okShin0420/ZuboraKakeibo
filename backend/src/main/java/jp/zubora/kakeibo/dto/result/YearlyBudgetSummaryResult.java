package jp.zubora.kakeibo.dto.result;

import java.util.List;

import jp.zubora.kakeibo.dto.MonthlyBudgetSummary;

public record YearlyBudgetSummaryResult(
        int year,
        List<Integer> availableYears,
        List<MonthlyBudgetSummary> monthlySummaries
) {
    public YearlyBudgetSummaryResult {
        availableYears = List.copyOf(availableYears);
        monthlySummaries = List.copyOf(monthlySummaries);
    }
}
