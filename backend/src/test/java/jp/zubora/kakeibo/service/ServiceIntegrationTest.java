package jp.zubora.kakeibo.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityManager;
import jp.zubora.kakeibo.dao.AppSettingsDao;
import jp.zubora.kakeibo.dao.BudgetCycleRuleDao;
import jp.zubora.kakeibo.dao.BudgetPeriodDao;
import jp.zubora.kakeibo.dao.ExpenseDao;
import jp.zubora.kakeibo.dao.HolidayCoverageDao;
import jp.zubora.kakeibo.dao.HolidayDao;
import jp.zubora.kakeibo.dto.command.CreateExpenseCommand;
import jp.zubora.kakeibo.dto.command.UpdateExpenseCommand;
import jp.zubora.kakeibo.dto.command.UpdateSettingsCommand;
import jp.zubora.kakeibo.entity.AppSettingsEntity;
import jp.zubora.kakeibo.entity.BudgetCycleRuleEntity;
import jp.zubora.kakeibo.entity.BudgetPeriodEntity;
import jp.zubora.kakeibo.entity.HolidayCalendarCoverageEntity;
import jp.zubora.kakeibo.entity.HolidayEntity;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:sqlite::memory:",
        "spring.datasource.hikari.maximum-pool-size=1",
        "spring.jpa.hibernate.ddl-auto=none",
        "logging.level.root=ERROR"
})
@Import(ServiceIntegrationTest.FixedClock.class)
@Transactional
class ServiceIntegrationTest {
    private static final LocalDate TODAY = LocalDate.of(2026, 9, 21);
    private static final Instant NOW = Instant.parse("2026-09-21T03:00:00Z");
    private static final UUID RULE_ID = UUID.fromString("11111111-1111-4111-8111-111111111111");
    private static final UUID PERIOD_ID = UUID.fromString("22222222-2222-4222-8222-222222222222");

    @TestConfiguration
    static class FixedClock {
        @Bean
        @Primary
        Clock fixedClock() {
            return Clock.fixed(NOW, ZoneId.of("Asia/Tokyo"));
        }
    }

    @Autowired private AppSettingsDao settingsDao;
    @Autowired private BudgetCycleRuleDao ruleDao;
    @Autowired private BudgetPeriodDao periodDao;
    @Autowired private ExpenseDao expenseDao;
    @Autowired private HolidayCoverageDao coverageDao;
    @Autowired private HolidayDao holidayDao;
    @Autowired private EntityManager entityManager;
    @Autowired private HomeService homeService;
    @Autowired private ExpenseService expenseService;
    @Autowired private CalendarService calendarService;
    @Autowired private GraphService graphService;
    @Autowired private BudgetService budgetService;
    @Autowired private SettingsService settingsService;

    @BeforeEach
    void seedCurrentPeriod() {
        AppSettingsEntity settings = new AppSettingsEntity();
        settings.setId((short) 1);
        settings.setMonthlyNotificationEnabled(true);
        settings.setTimezone("Asia/Tokyo");
        settings.setCreatedAt(NOW);
        settings.setUpdatedAt(NOW);
        settingsDao.save(settings);

        BudgetCycleRuleEntity rule = new BudgetCycleRuleEntity();
        rule.setId(RULE_ID);
        rule.setStartDay(18);
        rule.setAdjustForWeekendsAndHolidays(false);
        rule.setEffectiveFrom(LocalDate.of(2026, 1, 1));
        rule.setCreatedAt(NOW);
        rule.setUpdatedAt(NOW);
        ruleDao.save(rule);

        BudgetPeriodEntity period = new BudgetPeriodEntity();
        period.setId(PERIOD_ID);
        period.setCycleRuleId(RULE_ID);
        period.setLabelMonth(LocalDate.of(2026, 9, 1));
        period.setStartDate(LocalDate.of(2026, 9, 18));
        period.setNominalEndDate(LocalDate.of(2026, 10, 17));
        period.setEndDate(LocalDate.of(2026, 10, 17));
        period.setBudgetAmount(50_000);
        period.setCreatedAt(NOW);
        period.setUpdatedAt(NOW);
        periodDao.save(period);
        refreshQueries();
    }

    @Test
    void expenseBudgetHomeCalendarAndGraphUseTheSameStoredAmounts() {
        assertEquals(27, homeService.getHome(TODAY).remainingDays());
        var first = expenseService.createExpense(new CreateExpenseCommand(TODAY, 1_200, "ランチ"));
        expenseService.createExpense(new CreateExpenseCommand(LocalDate.of(2026, 9, 22), 800, ""));
        refreshQueries();

        var home = homeService.getHome(TODAY);
        assertEquals(48_000, home.remainingAmount());
        assertEquals(1_200, home.todayExpense());
        assertEquals("今日も、自分のペースで。", home.message());
        var calendar = calendarService.getMonthlyCalendar(YearMonth.of(2026, 9));
        assertEquals(LocalDate.of(2026, 9, 18), calendar.periodStart());
        assertEquals(2, calendar.dailyTotals().size());
        var daily = calendarService.getDailyExpenses(TODAY);
        assertEquals(1_200, daily.totalAmount());
        assertEquals(first.id(), daily.expenses().get(0).id());
        var graph = graphService.getYearlySummary(2026);
        assertEquals(12, graph.monthlySummaries().size());
        assertEquals(48_000, graph.monthlySummaries().get(8).remainingAmount());
        assertEquals(0, graph.monthlySummaries().get(9).budgetAmount());
        assertEquals(1, graph.availableYears().size());

        var updatedBudget = budgetService.updateCurrentBudget(TODAY, 60_000);
        assertEquals(58_000, updatedBudget.remainingAmount());
        refreshQueries();
        assertEquals(58_000, budgetService.getCurrentBudget(TODAY).remainingAmount());

        var edited = expenseService.updateExpense(first.id(), new UpdateExpenseCommand(
                LocalDate.of(2026, 9, 22), 1_500, ""));
        assertEquals(first.createdAt(), edited.createdAt());
        assertNull(edited.memo());
        refreshQueries();
        assertEquals(57_700, homeService.getHome(TODAY).remainingAmount());
        assertEquals(0, homeService.getHome(TODAY).todayExpense());
        assertEquals(2_300, calendarService.getDailyExpenses(LocalDate.of(2026, 9, 22)).totalAmount());
        expenseService.deleteExpense(first.id());
        refreshQueries();
        assertEquals(800, calendarService.getDailyExpenses(LocalDate.of(2026, 9, 22)).totalAmount());
        assertEquals(59_200, homeService.getHome(TODAY).remainingAmount());
    }

    @Test
    void notificationOnlyUpdateKeepsThePeriodAndRule() {
        var updated = settingsService.updateSettings(new UpdateSettingsCommand(false, 18, false));
        assertFalse(updated.monthlyNotificationEnabled());
        assertEquals(LocalDate.of(2026, 10, 18), updated.nextPeriodRange().startDate());
        assertEquals(1, ruleDao.count());
        assertEquals(1, periodDao.count());
    }

    @Test
    void calendarIncludesNextCalendarMonthInsideTheSamePeriod() {
        expenseService.createExpense(new CreateExpenseCommand(LocalDate.of(2026, 10, 10), 900, null));
        refreshQueries();
        var calendar = calendarService.getMonthlyCalendar(YearMonth.of(2026, 9));
        assertEquals(LocalDate.of(2026, 9, 18), calendar.periodStart());
        assertEquals(LocalDate.of(2026, 10, 17), calendar.periodEnd());
        assertEquals(LocalDate.of(2026, 10, 10), calendar.dailyTotals().get(0).date());
        assertEquals(900, calendar.dailyTotals().get(0).totalAmount());
    }

    @Test
    void calendarCreatesDecember2026PeriodOnDemand() {
        var december = calendarService.getMonthlyCalendar(YearMonth.of(2026, 12));
        assertEquals(LocalDate.of(2026, 12, 18), december.periodStart());
        assertEquals(LocalDate.of(2027, 1, 17), december.periodEnd());
        assertEquals(0, periodDao.findByLabelMonth(LocalDate.of(2026, 12, 1)).orElseThrow().getBudgetAmount());
    }

    @Test
    void changedRuleUpdatesCurrentPeriodAndLazilyCreatesUnbudgetedPreviousPeriod() {
        var updated = settingsService.updateSettings(new UpdateSettingsCommand(true, 20, false));
        calendarService.getMonthlyCalendar(YearMonth.of(2026, 8));
        assertEquals(20, updated.startDay());
        assertEquals(LocalDate.of(2026, 9, 20), updated.currentPeriodRange().startDate());
        assertEquals(LocalDate.of(2026, 9, 19), periodDao.findByLabelMonth(LocalDate.of(2026, 8, 1))
                .orElseThrow().getEndDate());
        assertEquals(LocalDate.of(2026, 10, 19), updated.currentPeriodRange().endDate());
        assertEquals(LocalDate.of(2026, 10, 20), updated.nextPeriodRange().startDate());
        assertEquals(2, periodDao.count());
        assertEquals(1, ruleDao.count());
        assertEquals(0, periodDao.findByLabelMonth(LocalDate.of(2026, 8, 1))
                .orElseThrow().getBudgetAmount());
        assertEquals(LocalDate.of(2026, 8, 20), periodDao.findByLabelMonth(LocalDate.of(2026, 8, 1))
                .orElseThrow().getStartDate());
        assertEquals(0, graphService.getYearlySummary(2026).monthlySummaries().get(7).budgetAmount());
        assertNull(ruleDao.findById(RULE_ID).orElseThrow().getEffectiveTo());
        assertFalse(settingsService.updateSettings(new UpdateSettingsCommand(false, 20, false))
                .monthlyNotificationEnabled());
        assertEquals(2, periodDao.count());
        var changedAgain = settingsService.updateSettings(new UpdateSettingsCommand(false, 21, false));
        assertEquals(21, changedAgain.startDay());
        assertEquals(LocalDate.of(2026, 9, 21), changedAgain.currentPeriodRange().startDate());
        assertEquals(LocalDate.of(2026, 10, 20), changedAgain.currentPeriodRange().endDate());
        assertEquals(LocalDate.of(2026, 10, 21), changedAgain.nextPeriodRange().startDate());
        assertEquals(2, periodDao.count());
        assertEquals(1, ruleDao.count());
        expenseService.createExpense(new CreateExpenseCommand(TODAY, 100, null));
        var moved = settingsService.updateSettings(new UpdateSettingsCommand(false, 22, false));
        assertEquals(LocalDate.of(2026, 8, 1), moved.currentPeriodRange().labelMonth());
        refreshQueries();
        assertEquals(-100, homeService.getHome(TODAY).remainingAmount());
        assertEquals(50_000, graphService.getYearlySummary(2026).monthlySummaries().get(8).remainingAmount());
    }

    @Test
    void earlierBoundaryReassignsAnExistingExpenseToFollowingPeriod() {
        expenseService.createExpense(new CreateExpenseCommand(LocalDate.of(2026, 10, 17), 500, null));
        refreshQueries();
        settingsService.updateSettings(new UpdateSettingsCommand(true, 15, false));
        refreshQueries();
        assertEquals(1, expenseDao.count());
        assertEquals(LocalDate.of(2026, 10, 15), periodDao.findByLabelMonth(LocalDate.of(2026, 10, 1))
                .orElseThrow().getStartDate());
        assertEquals(-500, graphService.getYearlySummary(2026).monthlySummaries().get(9).remainingAmount());
    }

    @Test
    void changingStartDayRebuildsPastMonthsAndMovesExpenseWithoutChangingBudgets() {
        calendarService.getMonthlyCalendar(YearMonth.of(2026, 8));
        budgetService.updateCurrentBudget(LocalDate.of(2026, 8, 20), 7_000);
        var expense = expenseService.createExpense(new CreateExpenseCommand(
                LocalDate.of(2026, 9, 10), 1_000, "保存済み"));
        refreshQueries();
        assertEquals(6_000, graphService.getYearlySummary(2026).monthlySummaries().get(7).remainingAmount());

        settingsService.updateSettings(new UpdateSettingsCommand(true, 8, false));
        refreshQueries();
        var august = periodDao.findByLabelMonth(LocalDate.of(2026, 8, 1)).orElseThrow();
        var september = periodDao.findByLabelMonth(LocalDate.of(2026, 9, 1)).orElseThrow();
        assertEquals(LocalDate.of(2026, 8, 8), august.getStartDate());
        assertEquals(LocalDate.of(2026, 9, 7), august.getEndDate());
        assertEquals(LocalDate.of(2026, 9, 8), september.getStartDate());
        assertEquals(LocalDate.of(2026, 10, 7), september.getEndDate());
        assertEquals(7_000, august.getBudgetAmount());
        assertEquals(50_000, september.getBudgetAmount());
        assertEquals(september.getId(), expenseDao.findById(expense.id()).orElseThrow().getBudgetPeriodId());
        assertEquals(7_000, graphService.getYearlySummary(2026).monthlySummaries().get(7).remainingAmount());
        assertEquals(49_000, homeService.getHome(TODAY).remainingAmount());
        assertEquals(1_000, calendarService.getMonthlyCalendar(YearMonth.of(2026, 9)).dailyTotals().get(0).totalAmount());
    }

    @Test
    void existingFollowingPeriodKeepsItsBudgetWhileExpensesMoveByDate() {
        BudgetPeriodEntity october = new BudgetPeriodEntity();
        october.setId(UUID.randomUUID());
        october.setCycleRuleId(RULE_ID);
        october.setLabelMonth(LocalDate.of(2026, 10, 1));
        october.setStartDate(LocalDate.of(2026, 10, 18));
        october.setNominalEndDate(LocalDate.of(2026, 11, 17));
        october.setEndDate(LocalDate.of(2026, 11, 17));
        october.setBudgetAmount(7_000);
        october.setCreatedAt(NOW);
        october.setUpdatedAt(NOW);
        periodDao.save(october);
        refreshQueries();
        var expense = expenseService.createExpense(new CreateExpenseCommand(LocalDate.of(2026, 10, 18), 1_000, "買い物"));
        settingsService.updateSettings(new UpdateSettingsCommand(true, 20, false));
        refreshQueries();
        var september = periodDao.findByLabelMonth(LocalDate.of(2026, 9, 1)).orElseThrow();
        var octoberAfter = periodDao.findByLabelMonth(LocalDate.of(2026, 10, 1)).orElseThrow();
        assertEquals(LocalDate.of(2026, 10, 19), september.getEndDate());
        assertEquals(LocalDate.of(2026, 10, 20), octoberAfter.getStartDate());
        assertEquals(7_000, octoberAfter.getBudgetAmount());
        assertEquals(september.getId(), expenseDao.findById(expense.id()).orElseThrow().getBudgetPeriodId());
        assertEquals(49_000, homeService.getHome(TODAY).remainingAmount());
        assertEquals(7_000, graphService.getYearlySummary(2026).monthlySummaries().get(9).remainingAmount());
        assertEquals(1_000, calendarService.getMonthlyCalendar(YearMonth.of(2026, 9)).dailyTotals().get(0).totalAmount());
    }

    @Test
    void holidayAdjustmentMovesStartAndCurrentEndTogether() {
        HolidayCalendarCoverageEntity coverage = new HolidayCalendarCoverageEntity();
        coverage.setCalendarYear((short) 2026);
        coverage.setSource("test");
        coverage.setImportedAt(NOW);
        coverageDao.save(coverage);
        HolidayEntity holiday = new HolidayEntity();
        holiday.setHolidayDate("2026-10-16");
        holiday.setCalendarYear((short) 2026);
        holiday.setName("test");
        holiday.setSource("test");
        holiday.setCreatedAt(NOW);
        holidayDao.save(holiday);
        refreshQueries();
        var updated = settingsService.updateSettings(new UpdateSettingsCommand(true, 18, true));
        assertEquals(LocalDate.of(2026, 10, 14), updated.currentPeriodRange().endDate());
        assertEquals(LocalDate.of(2026, 10, 15), updated.nextPeriodRange().startDate());
        var disabled = settingsService.updateSettings(new UpdateSettingsCommand(true, 18, false));
        assertFalse(disabled.adjustForWeekendsAndHolidays());
        assertEquals(LocalDate.of(2026, 10, 17), disabled.currentPeriodRange().endDate());
        assertEquals(LocalDate.of(2026, 10, 18), disabled.nextPeriodRange().startDate());
    }

    @Test
    void rejectsInvalidInputAndUnknownExpense() {
        assertThrows(IllegalArgumentException.class,
                () -> expenseService.createExpense(new CreateExpenseCommand(TODAY, 0, null)));
        assertThrows(IllegalArgumentException.class,
                () -> budgetService.updateCurrentBudget(TODAY, 1_000_000_000));
        assertThrows(IllegalArgumentException.class,
                () -> settingsService.updateSettings(new UpdateSettingsCommand(true, 32, false)));
        assertThrows(ResourceNotFoundException.class,
                () -> expenseService.updateExpense(UUID.randomUUID(), new UpdateExpenseCommand(TODAY, 100, null)));
        assertTrue(calendarService.getDailyExpenses(TODAY).expenses().isEmpty());
    }

    private void refreshQueries() {
        entityManager.flush();
        entityManager.clear();
    }
}
