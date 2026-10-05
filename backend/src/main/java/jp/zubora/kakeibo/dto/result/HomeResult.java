package jp.zubora.kakeibo.dto.result;

import java.time.LocalDate;

public record HomeResult(
        LocalDate labelMonth,
        long budgetAmount,
        long spentAmount,
        long remainingAmount,
        long todayExpense,
        int remainingDays,
        String message
) {
}
