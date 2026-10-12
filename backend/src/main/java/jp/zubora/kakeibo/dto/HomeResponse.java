package jp.zubora.kakeibo.dto;

import java.time.LocalDate;

public record HomeResponse(
        LocalDate labelMonth,
        long budgetAmount,
        long spentAmount,
        long remainingAmount,
        long todayExpense,
        int remainingDays,
        String message
) {
}
