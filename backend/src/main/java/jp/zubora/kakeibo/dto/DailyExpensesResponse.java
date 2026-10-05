package jp.zubora.kakeibo.dto;

import java.time.LocalDate;
import java.util.List;

public record DailyExpensesResponse(
        LocalDate date,
        long totalAmount,
        List<ExpenseResponse> expenses
) {
}
