package jp.zubora.kakeibo.dto.result;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

import jp.zubora.kakeibo.dto.DailyExpenseTotal;

public record CalendarMonthResult(
        YearMonth month,
        LocalDate periodStart,
        LocalDate periodEnd,
        List<DailyExpenseTotal> dailyTotals
) {
    public CalendarMonthResult {
        dailyTotals = List.copyOf(dailyTotals);
    }
}
