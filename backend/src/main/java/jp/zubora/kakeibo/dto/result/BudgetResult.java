package jp.zubora.kakeibo.dto.result;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record BudgetResult(
        UUID budgetPeriodId,
        LocalDate labelMonth,
        long budgetAmount,
        long remainingAmount,
        Instant updatedAt
) {
}
