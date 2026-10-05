package jp.zubora.kakeibo.dao;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import jp.zubora.kakeibo.entity.AppSettingsEntity;
import jp.zubora.kakeibo.entity.BudgetCycleRuleEntity;
import jp.zubora.kakeibo.entity.BudgetPeriodEntity;
import jp.zubora.kakeibo.entity.ExpenseEntity;
import jp.zubora.kakeibo.entity.HolidayCalendarCoverageEntity;
import jp.zubora.kakeibo.entity.HolidayEntity;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:sqlite::memory:",
        "spring.datasource.hikari.maximum-pool-size=1",
        "spring.jpa.hibernate.ddl-auto=none",
        "logging.level.root=ERROR"
})
@Transactional
class SqliteDaoIntegrationTest {
    private static final Instant NOW = Instant.parse("2026-09-01T00:00:00Z");
    private static final UUID RULE_ID = UUID.fromString("11111111-1111-4111-8111-111111111111");
    private static final UUID PERIOD_ID = UUID.fromString("22222222-2222-4222-8222-222222222222");
    private static final UUID FIRST_EXPENSE_ID = UUID.fromString("33333333-3333-4333-8333-333333333333");
    private static final UUID SECOND_EXPENSE_ID = UUID.fromString("44444444-4444-4444-8444-444444444444");

    @Autowired private AppSettingsDao appSettingsDao;
    @Autowired private BudgetCycleRuleDao budgetCycleRuleDao;
    @Autowired private BudgetPeriodDao budgetPeriodDao;
    @Autowired private ExpenseDao expenseDao;
    @Autowired private HolidayCoverageDao holidayCoverageDao;
    @Autowired private HolidayDao holidayDao;

    @Test
    void allRepositoriesExecuteAgainstMigratedSqliteSchema() {
        AppSettingsEntity settings = new AppSettingsEntity();
        settings.setId((short) 1);
        settings.setMonthlyNotificationEnabled(true);
        settings.setTimezone("Asia/Tokyo");
        settings.setCreatedAt(NOW);
        settings.setUpdatedAt(NOW);
        appSettingsDao.save(settings);
        assertTrue(appSettingsDao.findById((short) 1).orElseThrow().isMonthlyNotificationEnabled());

        BudgetCycleRuleEntity rule = new BudgetCycleRuleEntity();
        rule.setId(RULE_ID);
        rule.setStartDay(18);
        rule.setAdjustForWeekendsAndHolidays(true);
        rule.setEffectiveFrom(LocalDate.of(2026, 1, 1));
        rule.setCreatedAt(NOW);
        rule.setUpdatedAt(NOW);
        budgetCycleRuleDao.save(rule);
        assertEquals(RULE_ID, budgetCycleRuleDao.findEffectiveAt(LocalDate.of(2026, 9, 21)).orElseThrow().getId());
        assertEquals(1, budgetCycleRuleDao.findOverlapping(
                LocalDate.of(2026, 9, 1), LocalDate.of(2026, 10, 1)).size());

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
        budgetPeriodDao.save(period);
        assertEquals(PERIOD_ID, budgetPeriodDao.findContainingDate(LocalDate.of(2026, 10, 1)).orElseThrow().getId());
        assertEquals(PERIOD_ID, budgetPeriodDao.findByLabelMonth(LocalDate.of(2026, 9, 1)).orElseThrow().getId());
        assertEquals(1, budgetPeriodDao.findOverlappingDateRange(
                LocalDate.of(2026, 9, 20), LocalDate.of(2026, 9, 30)).size());

        ExpenseEntity first = expense(FIRST_EXPENSE_ID, LocalDate.of(2026, 9, 21), 1_200, "Lunch", 1);
        ExpenseEntity second = expense(SECOND_EXPENSE_ID, LocalDate.of(2026, 9, 22), 800, null, 2);
        expenseDao.saveAll(List.of(first, second));
        assertEquals(FIRST_EXPENSE_ID, expenseDao.findById(FIRST_EXPENSE_ID).orElseThrow().getId());
        assertEquals(1, expenseDao.findAllBySpentOnOrderByCreatedAtAsc(LocalDate.of(2026, 9, 21)).size());
        assertTrue(expenseDao.existsByBudgetPeriodIdAndSpentOnAfter(PERIOD_ID, LocalDate.of(2026, 9, 21)));
        assertEquals(1_200, expenseDao.sumAmountBySpentOn(LocalDate.of(2026, 9, 21)));
        List<DailyExpenseTotalProjection> dailyTotals = expenseDao.sumAmountByDateRange(
                LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30));
        assertEquals(2, dailyTotals.size());
        assertEquals(LocalDate.of(2026, 9, 21), dailyTotals.get(0).getSpentOn());
        assertEquals(1_200, dailyTotals.get(0).getTotalAmount());

        var summary = budgetPeriodDao.findSummaryContaining(LocalDate.of(2026, 10, 1)).orElseThrow();
        assertEquals(2_000, summary.getSpentAmount());
        assertEquals(48_000, summary.getRemainingAmount());
        assertEquals(2, summary.getExpenseCount());
        assertEquals(1, budgetPeriodDao.findSummariesByLabelMonthBetween(
                LocalDate.of(2026, 9, 1), LocalDate.of(2026, 12, 1)).size());
        assertEquals(List.of(2026), budgetPeriodDao.findDistinctLabelYears());

        HolidayCalendarCoverageEntity coverage = new HolidayCalendarCoverageEntity();
        coverage.setCalendarYear((short) 2026);
        coverage.setSource("integration-test");
        coverage.setImportedAt(NOW);
        holidayCoverageDao.save(coverage);
        assertTrue(holidayCoverageDao.existsById((short) 2026));

        HolidayEntity holiday = new HolidayEntity();
        holiday.setHolidayDate(LocalDate.of(2026, 9, 21).toString());
        holiday.setCalendarYear((short) 2026);
        holiday.setName("Test holiday");
        holiday.setSource("integration-test");
        holiday.setCreatedAt(NOW);
        holidayDao.save(holiday);
        assertEquals(1, holidayDao.findAllByCalendarYearOrderByHolidayDateAsc((short) 2026).size());
    }

    private static ExpenseEntity expense(UUID id, LocalDate spentOn, long amount, String memo, int second) {
        ExpenseEntity expense = new ExpenseEntity();
        expense.setId(id);
        expense.setBudgetPeriodId(PERIOD_ID);
        expense.setSpentOn(spentOn);
        expense.setAmount(amount);
        expense.setMemo(memo);
        expense.setCreatedAt(NOW.plusSeconds(second));
        expense.setUpdatedAt(NOW.plusSeconds(second));
        return expense;
    }
}
