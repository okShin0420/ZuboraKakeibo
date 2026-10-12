package jp.zubora.kakeibo.dto;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

public record CalendarMonthResponse(
        YearMonth month,
        LocalDate periodStart,
        LocalDate periodEnd,
        List<DailyExpenseTotal> dailyTotals
) {
}
