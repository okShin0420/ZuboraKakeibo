package jp.zubora.kakeibo.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record BudgetResponse(
        UUID budgetPeriodId,
        LocalDate labelMonth,
        long budgetAmount,
        long remainingAmount,
        Instant updatedAt
) {
}
