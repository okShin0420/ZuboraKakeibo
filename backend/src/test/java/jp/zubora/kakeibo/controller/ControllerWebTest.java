package jp.zubora.kakeibo.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import jp.zubora.kakeibo.dto.DailyExpenseTotal;
import jp.zubora.kakeibo.dto.MonthlyBudgetSummary;
import jp.zubora.kakeibo.dto.command.CreateExpenseCommand;
import jp.zubora.kakeibo.dto.command.UpdateExpenseCommand;
import jp.zubora.kakeibo.dto.command.UpdateSettingsCommand;
import jp.zubora.kakeibo.dto.result.BudgetResult;
import jp.zubora.kakeibo.dto.result.CalendarMonthResult;
import jp.zubora.kakeibo.dto.result.DailyExpensesResult;
import jp.zubora.kakeibo.dto.result.ExpenseResult;
import jp.zubora.kakeibo.dto.result.HomeResult;
import jp.zubora.kakeibo.dto.result.PeriodRangeResult;
import jp.zubora.kakeibo.dto.result.SettingsResult;
import jp.zubora.kakeibo.dto.result.YearlyBudgetSummaryResult;
import jp.zubora.kakeibo.service.BudgetService;
import jp.zubora.kakeibo.service.BusinessRuleException;
import jp.zubora.kakeibo.service.CalendarService;
import jp.zubora.kakeibo.service.ExpenseService;
import jp.zubora.kakeibo.service.GraphService;
import jp.zubora.kakeibo.service.HomeService;
import jp.zubora.kakeibo.service.PeriodConflictException;
import jp.zubora.kakeibo.service.ResourceNotFoundException;
import jp.zubora.kakeibo.service.SettingsService;
import jp.zubora.kakeibo.service.SetupService;

@WebMvcTest(controllers = {
        HomeController.class, ExpenseController.class, CalendarController.class,
        GraphController.class, SettingsController.class, BudgetController.class, SetupController.class
})
@Import({ApiExceptionHandler.class, ControllerWebTest.FixedClock.class})
class ControllerWebTest {
    private static final LocalDate TODAY = LocalDate.of(2026, 9, 21);
    private static final Instant NOW = Instant.parse("2026-09-21T03:00:00Z");
    private static final UUID PERIOD_ID = UUID.fromString("22222222-2222-4222-8222-222222222222");
    private static final UUID EXPENSE_ID = UUID.fromString("33333333-3333-4333-8333-333333333333");

    @TestConfiguration
    static class FixedClock {
        @Bean
        Clock clock() {
            return Clock.fixed(NOW, ZoneId.of("Asia/Tokyo"));
        }
    }

    @Autowired private MockMvc mvc;
    @MockitoBean private HomeService homeService;
    @MockitoBean private ExpenseService expenseService;
    @MockitoBean private CalendarService calendarService;
    @MockitoBean private GraphService graphService;
    @MockitoBean private SettingsService settingsService;
    @MockitoBean private BudgetService budgetService;
    @MockitoBean private SetupService setupService;

    @Test
    void allTenRoutesConvertServiceResultsToDocumentedResponses() throws Exception {
        when(homeService.getHome(TODAY)).thenReturn(new HomeResult(
                LocalDate.of(2026, 9, 1), 50_000, 1_800, 48_200, 1_200, 10, "今日も、自分のペースで。"));
        mvc.perform(get("/api/v1/home").param("asOf", "2026-09-21"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.remainingAmount").value(48_200))
                .andExpect(jsonPath("$.todayExpense").value(1_200));

        ExpenseResult expense = new ExpenseResult(EXPENSE_ID, PERIOD_ID, TODAY, 1_200, "ランチ", NOW, NOW);
        when(expenseService.createExpense(any(CreateExpenseCommand.class))).thenReturn(expense);
        mvc.perform(post("/api/v1/expenses").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"spentOn\":\"2026-09-21\",\"amount\":1200,\"memo\":\"ランチ\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(EXPENSE_ID.toString()))
                .andExpect(jsonPath("$.amount").value(1_200));
        verify(expenseService).createExpense(new CreateExpenseCommand(TODAY, 1_200, "ランチ"));

        when(expenseService.updateExpense(eq(EXPENSE_ID), any(UpdateExpenseCommand.class)))
                .thenReturn(new ExpenseResult(EXPENSE_ID, PERIOD_ID, TODAY, 1_500, null, NOW, NOW));
        mvc.perform(put("/api/v1/expenses/{expenseId}", EXPENSE_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"spentOn\":\"2026-09-21\",\"amount\":1500}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.amount").value(1_500));
        mvc.perform(delete("/api/v1/expenses/{expenseId}", EXPENSE_ID))
                .andExpect(status().isNoContent());
        verify(expenseService).deleteExpense(EXPENSE_ID);

        when(calendarService.getMonthlyCalendar(YearMonth.of(2026, 9)))
                .thenReturn(new CalendarMonthResult(YearMonth.of(2026, 9),
                        LocalDate.of(2026, 9, 18), LocalDate.of(2026, 10, 17),
                        List.of(new DailyExpenseTotal(TODAY, 1_200))));
        mvc.perform(get("/api/v1/calendar").param("month", "2026-09"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.month").value("2026-09"))
                .andExpect(jsonPath("$.dailyTotals[0].totalAmount").value(1_200));

        when(calendarService.getDailyExpenses(TODAY))
                .thenReturn(new DailyExpensesResult(TODAY, 1_200, List.of(expense)));
        mvc.perform(get("/api/v1/calendar/days/2026-09-21"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.expenses[0].memo").value("ランチ"));

        when(graphService.getYearlySummary(2026)).thenReturn(new YearlyBudgetSummaryResult(2026,
                List.of(2026), List.of(new MonthlyBudgetSummary(9, 50_000, 1_800, 48_200, 2))));
        mvc.perform(get("/api/v1/graphs/yearly").param("year", "2026"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.availableYears[0]").value(2026))
                .andExpect(jsonPath("$.monthlySummaries[0].remainingAmount").value(48_200));

        SettingsResult settings = new SettingsResult(true, "Asia/Tokyo", 18, false, 50_000,
                new PeriodRangeResult(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 18),
                        LocalDate.of(2026, 10, 17), LocalDate.of(2026, 10, 17)),
                new PeriodRangeResult(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 18),
                        LocalDate.of(2026, 11, 17), LocalDate.of(2026, 11, 17)));
        when(settingsService.getSettings(TODAY)).thenReturn(settings);
        mvc.perform(get("/api/v1/settings"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.startDay").value(18))
                .andExpect(jsonPath("$.nextPeriodRange.startDate").value("2026-10-18"));
        verify(settingsService).getSettings(TODAY);
        when(settingsService.updateSettings(any(UpdateSettingsCommand.class))).thenReturn(settings);
        mvc.perform(put("/api/v1/settings").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"monthlyNotificationEnabled\":true,\"startDay\":18,\"adjustForWeekendsAndHolidays\":false}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.currentBudgetAmount").value(50_000));
        verify(settingsService).updateSettings(new UpdateSettingsCommand(true, 18, false));

        when(setupService.isInitialized()).thenReturn(true);
        mvc.perform(get("/api/v1/setup"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.initialized").value(true));
        when(setupService.setup(50_000)).thenReturn(settings);
        mvc.perform(post("/api/v1/setup").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"budgetAmount\":50000}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.startDay").value(18));

        BudgetResult budget = new BudgetResult(PERIOD_ID, LocalDate.of(2026, 9, 1), 50_000, 48_200, NOW);
        when(budgetService.getCurrentBudget(TODAY)).thenReturn(budget);
        mvc.perform(get("/api/v1/budgets/current").param("asOf", "2026-09-21"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.budgetAmount").value(50_000));
        when(budgetService.updateCurrentBudget(TODAY, 50_000)).thenReturn(budget);
        mvc.perform(put("/api/v1/budgets/current").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"asOf\":\"2026-09-21\",\"amount\":50000}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.remainingAmount").value(48_200));
    }

    @Test
    void invalidRequestsReturnFieldErrorsAndDoNotReachServices() throws Exception {
        mvc.perform(post("/api/v1/expenses").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":0,\"memo\":\"test\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors.spentOn").exists())
                .andExpect(jsonPath("$.fieldErrors.amount").exists());
        mvc.perform(put("/api/v1/settings").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"monthlyNotificationEnabled\":true,\"startDay\":32,\"adjustForWeekendsAndHolidays\":false}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.startDay").exists());
        mvc.perform(put("/api/v1/budgets/current").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"asOf\":\"2026-09-21\",\"amount\":0}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.amount").exists());
        mvc.perform(get("/api/v1/home").param("asOf", "wrong"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.asOf").exists());
        mvc.perform(get("/api/v1/calendar").param("month", "2026-13"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/budgets/current"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.asOf").exists());
        mvc.perform(post("/api/v1/expenses").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"spentOn\":\"not-a-date\",\"amount\":100}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/setup").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"budgetAmount\":0}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.budgetAmount").exists());
    }

    @Test
    void domainFailuresUseDocumentedStatuses() throws Exception {
        when(homeService.getHome(TODAY)).thenThrow(new ResourceNotFoundException("月度が見つかりません"));
        mvc.perform(get("/api/v1/home").param("asOf", "2026-09-21"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
        when(budgetService.updateCurrentBudget(TODAY, 100))
                .thenThrow(new PeriodConflictException("期間が競合しています"));
        mvc.perform(put("/api/v1/budgets/current").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"asOf\":\"2026-09-21\",\"amount\":100}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONFLICT"));
        when(graphService.getYearlySummary(2026)).thenThrow(new BusinessRuleException("条件を確認してください"));
        mvc.perform(get("/api/v1/graphs/yearly").param("year", "2026"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("BUSINESS_RULE"));
    }
}
