package jp.zubora.kakeibo.dto.result;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ExpenseResult(
        UUID id,
        UUID budgetPeriodId,
        LocalDate spentOn,
        long amount,
        String memo,
        Instant createdAt,
        Instant updatedAt
) {
}
