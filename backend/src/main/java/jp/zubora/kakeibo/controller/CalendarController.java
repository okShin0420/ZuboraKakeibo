package jp.zubora.kakeibo.controller;

import java.time.LocalDate;
import java.time.YearMonth;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jp.zubora.kakeibo.dto.CalendarMonthResponse;
import jp.zubora.kakeibo.dto.DailyExpensesResponse;
import jp.zubora.kakeibo.service.CalendarService;

@RestController
@RequestMapping("/api/v1/calendar")
public class CalendarController {
    private final CalendarService service;

    public CalendarController(CalendarService service) {
        this.service = service;
    }

    @GetMapping
    public CalendarMonthResponse getMonthlyCalendar(@RequestParam @DateTimeFormat(pattern = "yyyy-MM") YearMonth month) {
        var result = service.getMonthlyCalendar(month);
        return new CalendarMonthResponse(result.month(), result.periodStart(), result.periodEnd(), result.dailyTotals());
    }

    @GetMapping("/days/{date}")
    public DailyExpensesResponse getDailyExpenses(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        var result = service.getDailyExpenses(date);
        return new DailyExpensesResponse(result.date(), result.totalAmount(),
                result.expenses().stream().map(ResponseMapper::expense).toList());
    }
}
