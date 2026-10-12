package jp.zubora.kakeibo.dto.result;

import java.time.LocalDate;
import java.util.List;

public record DailyExpensesResult(LocalDate date, long totalAmount, List<ExpenseResult> expenses) {
    public DailyExpensesResult {
        expenses = List.copyOf(expenses);
    }
}
