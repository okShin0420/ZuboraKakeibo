package jp.zubora.kakeibo.dto.result;

import java.time.LocalDate;
import java.util.Objects;

public record PeriodRangeResult(
        LocalDate labelMonth,
        LocalDate startDate,
        LocalDate nominalEndDate,
        LocalDate endDate
) {
    public PeriodRangeResult {
        Objects.requireNonNull(labelMonth, "labelMonth");
        Objects.requireNonNull(startDate, "startDate");
        Objects.requireNonNull(nominalEndDate, "nominalEndDate");
        Objects.requireNonNull(endDate, "endDate");
        if (labelMonth.getDayOfMonth() != 1 || endDate.isBefore(startDate)) {
            throw new IllegalArgumentException("月度の範囲が不正です");
        }
    }
}
