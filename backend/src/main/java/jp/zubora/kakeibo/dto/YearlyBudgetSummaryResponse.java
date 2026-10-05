package jp.zubora.kakeibo.dto;

import java.util.List;

public record YearlyBudgetSummaryResponse(
        int year,
        List<Integer> availableYears,
        List<MonthlyBudgetSummary> monthlySummaries
) {
}
