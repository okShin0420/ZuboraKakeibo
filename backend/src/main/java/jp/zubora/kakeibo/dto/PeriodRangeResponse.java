package jp.zubora.kakeibo.dto;

import java.time.LocalDate;

public record PeriodRangeResponse(
        LocalDate labelMonth,
        LocalDate startDate,
        LocalDate endDate
) {
}
