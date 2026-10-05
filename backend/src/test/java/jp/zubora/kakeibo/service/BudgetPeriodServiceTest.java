package jp.zubora.kakeibo.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.time.Clock;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import jp.zubora.kakeibo.dao.BudgetPeriodDao;
import jp.zubora.kakeibo.dao.ExpenseDao;
import jp.zubora.kakeibo.dao.HolidayCoverageDao;
import jp.zubora.kakeibo.dao.HolidayDao;
import jp.zubora.kakeibo.entity.BudgetCycleRuleEntity;
import jp.zubora.kakeibo.entity.BudgetPeriodEntity;
import jp.zubora.kakeibo.dto.result.PeriodRangeResult;

class BudgetPeriodServiceTest {
    private BudgetPeriodDao periodDao;
    private HolidayCoverageDao coverageDao;
    private HolidayDao holidayDao;
    private BudgetPeriodService service;

    @BeforeEach
    void setUp() {
        periodDao = mock(BudgetPeriodDao.class);
        coverageDao = mock(HolidayCoverageDao.class);
        holidayDao = mock(HolidayDao.class);
        service = new BudgetPeriodService(periodDao, coverageDao, holidayDao,
                mock(ExpenseDao.class), Clock.systemUTC());
    }

    private static BudgetCycleRuleEntity rule(int startDay, boolean adjust) {
        BudgetCycleRuleEntity rule = new BudgetCycleRuleEntity();
        rule.setStartDay(startDay);
        rule.setAdjustForWeekendsAndHolidays(adjust);
        return rule;
    }

    private static void assertRange(PeriodRangeResult actual, String label, String start, String nominalEnd, String end) {
        assertEquals(LocalDate.parse(label), actual.labelMonth());
        assertEquals(LocalDate.parse(start), actual.startDate());
        assertEquals(LocalDate.parse(nominalEnd), actual.nominalEndDate());
        assertEquals(LocalDate.parse(end), actual.endDate());
    }

    @Test
    void firstDayCoversTheCalendarMonthWithoutHolidayLookup() {
        assertRange(service.calculatePeriod(YearMonth.of(2026, 9), rule(1, false)),
                "2026-09-01", "2026-09-01", "2026-09-30", "2026-09-30");
        verifyNoInteractions(coverageDao, holidayDao);
    }

    @Test
    void startDay25EndsOnTheDayBeforeTheNextStart() {
        assertRange(service.calculatePeriod(YearMonth.of(2026, 9), rule(25, false)),
                "2026-09-01", "2026-09-25", "2026-10-24", "2026-10-24");
    }

    @Test
    void missingDatesAreClampedToMonthEndIncludingLeapFebruary() {
        assertRange(service.calculatePeriod(YearMonth.of(2026, 1), rule(31, false)),
                "2026-01-01", "2026-01-31", "2026-02-27", "2026-02-27");
        assertRange(service.calculatePeriod(YearMonth.of(2026, 2), rule(31, false)),
                "2026-02-01", "2026-02-28", "2026-03-30", "2026-03-30");
        assertRange(service.calculatePeriod(YearMonth.of(2028, 2), rule(31, false)),
                "2028-02-01", "2028-02-29", "2028-03-30", "2028-03-30");
        assertRange(service.calculatePeriod(YearMonth.of(2026, 4), rule(31, false)),
                "2026-04-01", "2026-04-30", "2026-05-30", "2026-05-30");
        assertRange(service.calculatePeriod(YearMonth.of(2026, 2), rule(29, false)),
                "2026-02-01", "2026-02-28", "2026-03-28", "2026-03-28");
        assertRange(service.calculatePeriod(YearMonth.of(2026, 2), rule(30, false)),
                "2026-02-01", "2026-02-28", "2026-03-29", "2026-03-29");
    }

    @Test
    void weekendAtNextStartMovesTheCurrentEndForwardToThePreviousBusinessDay() {
        when(coverageDao.existsById((short) 2026)).thenReturn(true);
        assertRange(service.calculatePeriod(YearMonth.of(2026, 9), rule(25, true)),
                "2026-09-01", "2026-09-25", "2026-10-24", "2026-10-22");
    }

    @Test
    void holidayAndWeekendMoveTheStartBackWithoutCreatingAGap() {
        when(coverageDao.existsById((short) 2026)).thenReturn(true);
        when(holidayDao.existsById(LocalDate.of(2026, 10, 16).toString())).thenReturn(true);
        PeriodRangeResult september = service.calculatePeriod(YearMonth.of(2026, 9), rule(18, true));
        PeriodRangeResult october = service.calculatePeriod(YearMonth.of(2026, 10), rule(18, true));
        assertEquals(LocalDate.of(2026, 10, 14), september.endDate());
        assertEquals(LocalDate.of(2026, 10, 15), october.startDate());
        assertEquals(september.endDate().plusDays(1), october.startDate());
    }

    @Test
    void weekendAtFebruaryMonthEndMovesThirtyFirstStartToFriday() {
        when(coverageDao.existsById((short) 2026)).thenReturn(true);
        assertRange(service.calculatePeriod(YearMonth.of(2026, 2), rule(31, true)),
                "2026-02-01", "2026-02-27", "2026-03-30", "2026-03-30");
    }

    @Test
    void yearBoundaryRequiresCoverageForTheYearReachedByAdjustment() {
        when(coverageDao.existsById((short) 2027)).thenReturn(true);
        when(coverageDao.existsById((short) 2026)).thenReturn(true);
        when(holidayDao.existsById(LocalDate.of(2027, 1, 1).toString())).thenReturn(true);
        assertRange(service.calculatePeriod(YearMonth.of(2026, 12), rule(1, true)),
                "2026-12-01", "2026-12-01", "2026-12-31", "2026-12-30");
    }

    @Test
    void missingPreviousYearCoverageIsRejectedWhenJanuaryStartMovesIntoDecember() {
        when(coverageDao.existsById((short) 2027)).thenReturn(true);
        when(holidayDao.existsById(LocalDate.of(2027, 1, 1).toString())).thenReturn(true);
        assertThrows(IllegalStateException.class,
                () -> service.calculatePeriod(YearMonth.of(2027, 1), rule(1, true)));
    }

    @Test
    void nextRuleDefinesTheCurrentPeriodEnd() {
        PeriodRangeResult september = service.calculatePeriod(YearMonth.of(2026, 9), rule(18, false), rule(25, false));
        PeriodRangeResult october = service.calculatePeriod(YearMonth.of(2026, 10), rule(25, false));
        assertRange(september, "2026-09-01", "2026-09-18", "2026-10-24", "2026-10-24");
        assertEquals(september.endDate().plusDays(1), october.startDate());
    }

    @Test
    void invalidDayAndMissingHolidayCoverageAreRejected() {
        assertThrows(IllegalArgumentException.class,
                () -> service.calculatePeriod(YearMonth.of(2026, 9), rule(0, false)));
        assertThrows(IllegalArgumentException.class,
                () -> service.calculatePeriod(YearMonth.of(2026, 9), rule(32, false)));
        assertThrows(IllegalStateException.class,
                () -> service.calculatePeriod(YearMonth.of(2026, 9), rule(1, true)));
    }

    @Test
    void ruleChangeThatWouldReverseThePeriodIsRejected() {
        when(coverageDao.existsById((short) 2026)).thenReturn(true);
        assertThrows(IllegalStateException.class,
                () -> service.calculatePeriod(YearMonth.of(2026, 1), rule(31, false), rule(1, true)));
    }

    @Test
    void overlappingPeriodsAreRejectedButAnUpdatedPeriodCanExcludeItself() {
        PeriodRangeResult candidate = service.calculatePeriod(YearMonth.of(2026, 9), rule(18, false));
        BudgetPeriodEntity existing = new BudgetPeriodEntity();
        existing.setId(UUID.randomUUID());
        when(periodDao.findOverlappingDateRange(any(), any())).thenReturn(List.of(existing));
        assertThrows(PeriodConflictException.class, () -> service.assertNoOverlap(candidate, null));
        assertDoesNotThrow(() -> service.assertNoOverlap(candidate, existing.getId()));
    }
}
