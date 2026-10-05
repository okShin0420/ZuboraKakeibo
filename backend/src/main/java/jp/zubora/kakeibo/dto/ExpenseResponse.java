package jp.zubora.kakeibo.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ExpenseResponse(
        UUID id,
        UUID budgetPeriodId,
        LocalDate spentOn,
        long amount,
        String memo,
        Instant createdAt,
        Instant updatedAt
) {
}
