package jp.zubora.kakeibo.service;

import java.time.DayOfWeek;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jp.zubora.kakeibo.dao.BudgetPeriodDao;
import jp.zubora.kakeibo.dao.ExpenseDao;
import jp.zubora.kakeibo.dao.HolidayCoverageDao;
import jp.zubora.kakeibo.dao.HolidayDao;
import jp.zubora.kakeibo.dto.result.PeriodRangeResult;
import jp.zubora.kakeibo.entity.BudgetCycleRuleEntity;
import jp.zubora.kakeibo.entity.BudgetPeriodEntity;

@Service
@Transactional(readOnly = true)
public class BudgetPeriodService {
    private final BudgetPeriodDao budgetPeriodDao;
    private final HolidayCoverageDao holidayCoverageDao;
    private final HolidayDao holidayDao;
    private final ExpenseDao expenseDao;
    private final Clock clock;

    public BudgetPeriodService(BudgetPeriodDao budgetPeriodDao, HolidayCoverageDao holidayCoverageDao,
                               HolidayDao holidayDao, ExpenseDao expenseDao, Clock clock) {
        this.budgetPeriodDao = budgetPeriodDao;
        this.holidayCoverageDao = holidayCoverageDao;
        this.holidayDao = holidayDao;
        this.expenseDao = expenseDao;
        this.clock = clock;
    }

    public PeriodRangeResult calculatePeriod(YearMonth labelMonth, BudgetCycleRuleEntity rule) {
        return calculatePeriod(labelMonth, rule, rule);
    }

    /** The following month's rule determines this month's end, even when settings change. */
    public PeriodRangeResult calculatePeriod(YearMonth labelMonth, BudgetCycleRuleEntity currentRule,
                                             BudgetCycleRuleEntity nextRule) {
        Objects.requireNonNull(labelMonth, "labelMonth");
        validateRule(currentRule);
        validateRule(nextRule);

        LocalDate scheduledStart = scheduledStart(labelMonth, currentRule.getStartDay());
        LocalDate start = adjustedStart(scheduledStart, currentRule.isAdjustForWeekendsAndHolidays());
        LocalDate nextScheduledStart = scheduledStart(labelMonth.plusMonths(1), nextRule.getStartDay());
        LocalDate nextStart = adjustedStart(nextScheduledStart, nextRule.isAdjustForWeekendsAndHolidays());
        LocalDate end = nextStart.minusDays(1);
        if (end.isBefore(start)) {
            throw new BusinessRuleException("調整後の月度終了日が開始日より前になります");
        }
        return new PeriodRangeResult(labelMonth.atDay(1), start, nextScheduledStart.minusDays(1), end);
    }

    public void assertNoOverlap(PeriodRangeResult candidate, UUID excludedPeriodId) {
        Objects.requireNonNull(candidate, "candidate");
        List<BudgetPeriodEntity> overlaps = budgetPeriodDao.findOverlappingDateRange(
                candidate.startDate(), candidate.endDate());
        if (overlaps.stream().anyMatch(period -> !period.getId().equals(excludedPeriodId))) {
            throw new PeriodConflictException("予算期間が既存の期間と重複しています");
        }
    }

    @Transactional
    public PeriodRangeResult applyNextPeriodRule(LocalDate asOf, BudgetCycleRuleEntity nextRule) {
        ServiceValues.date(asOf);
        validateRule(nextRule);
        BudgetPeriodEntity current = budgetPeriodDao.findContainingDate(asOf)
                .orElseThrow(() -> new ResourceNotFoundException("進行中の月度が見つかりません"));
        YearMonth nextMonth = YearMonth.from(current.getLabelMonth()).plusMonths(1);
        PeriodRangeResult nextRange = calculatePeriod(nextMonth, nextRule);
        if (!nextRange.startDate().isAfter(asOf) || !nextRange.startDate().isAfter(current.getStartDate())) {
            throw new BusinessRuleException("次月度の開始日は進行中の月度内の日付より後にしてください");
        }
        if (budgetPeriodDao.findByLabelMonth(nextRange.labelMonth()).isPresent()) {
            throw new PeriodConflictException("次月度はすでに作成されています");
        }
        assertNoOverlap(nextRange, current.getId());
        LocalDate newCurrentEnd = nextRange.startDate().minusDays(1);
        if (expenseDao.existsByBudgetPeriodIdAndSpentOnAfter(current.getId(), newCurrentEnd)) {
            throw new PeriodConflictException("境界変更後に期間外となる支出があります");
        }
        LocalDate scheduledNextStart = nextMonth.atDay(Math.min(nextRule.getStartDay(), nextMonth.lengthOfMonth()));
        current.setNominalEndDate(scheduledNextStart.minusDays(1));
        current.setEndDate(newCurrentEnd);
        current.setUpdatedAt(clock.instant());
        budgetPeriodDao.save(current);

        BudgetPeriodEntity next = new BudgetPeriodEntity();
        next.setId(UUID.randomUUID());
        next.setCycleRuleId(nextRule.getId());
        next.setLabelMonth(nextRange.labelMonth());
        next.setStartDate(nextRange.startDate());
        next.setNominalEndDate(nextRange.nominalEndDate());
        next.setEndDate(nextRange.endDate());
        next.setBudgetAmount(0);
        next.setCreatedAt(clock.instant());
        next.setUpdatedAt(next.getCreatedAt());
        budgetPeriodDao.save(next);
        return nextRange;
    }

    @Transactional
    public PeriodRangeResult replaceNextPeriodRule(LocalDate asOf, BudgetCycleRuleEntity nextRule,
                                                    BudgetPeriodEntity existingNext) {
        ServiceValues.date(asOf);
        validateRule(nextRule);
        Objects.requireNonNull(existingNext, "existingNext");
        BudgetPeriodEntity current = budgetPeriodDao.findContainingDate(asOf)
                .orElseThrow(() -> new ResourceNotFoundException("進行中の月度が見つかりません"));
        YearMonth nextMonth = YearMonth.from(current.getLabelMonth()).plusMonths(1);
        if (!existingNext.getLabelMonth().equals(nextMonth.atDay(1))
                || !existingNext.getStartDate().isAfter(asOf)
                || expenseDao.existsByBudgetPeriodId(existingNext.getId())
                || budgetPeriodDao.existsByStartDateAfter(existingNext.getStartDate())) {
            throw new PeriodConflictException("次月度にはすでに支出または後続の月度があり、設定を変更できません");
        }
        PeriodRangeResult nextRange = calculatePeriod(nextMonth, nextRule);
        if (!nextRange.startDate().isAfter(asOf) || !nextRange.startDate().isAfter(current.getStartDate())) {
            throw new BusinessRuleException("次月度の開始日は進行中の月度内の日付より後にしてください");
        }
        if (budgetPeriodDao.findOverlappingDateRange(current.getStartDate(), nextRange.startDate().minusDays(1))
                .stream().anyMatch(period -> !period.getId().equals(current.getId())
                        && !period.getId().equals(existingNext.getId()))
                || budgetPeriodDao.findOverlappingDateRange(nextRange.startDate(), nextRange.endDate())
                        .stream().anyMatch(period -> !period.getId().equals(current.getId())
                                && !period.getId().equals(existingNext.getId()))) {
            throw new PeriodConflictException("予算期間が既存の期間と重複しています");
        }
        LocalDate newCurrentEnd = nextRange.startDate().minusDays(1);
        if (expenseDao.existsByBudgetPeriodIdAndSpentOnAfter(current.getId(), newCurrentEnd)) {
            throw new PeriodConflictException("境界変更後に期間外となる支出があります");
        }
        LocalDate scheduledNextStart = nextMonth.atDay(Math.min(nextRule.getStartDay(), nextMonth.lengthOfMonth()));
        current.setNominalEndDate(scheduledNextStart.minusDays(1));
        current.setEndDate(newCurrentEnd);
        current.setUpdatedAt(clock.instant());
        budgetPeriodDao.save(current);
        existingNext.setCycleRuleId(nextRule.getId());
        existingNext.setStartDate(nextRange.startDate());
        existingNext.setNominalEndDate(nextRange.nominalEndDate());
        existingNext.setEndDate(nextRange.endDate());
        existingNext.setUpdatedAt(clock.instant());
        budgetPeriodDao.saveAndFlush(existingNext);
        return nextRange;
    }

    private static void validateRule(BudgetCycleRuleEntity rule) {
        Objects.requireNonNull(rule, "rule");
        if (rule.getStartDay() < 1 || rule.getStartDay() > 31) {
            throw new IllegalArgumentException("月度の開始日は1〜31日で指定してください");
        }
    }

    private static LocalDate scheduledStart(YearMonth month, int startDay) {
        return month.atDay(Math.min(startDay, month.lengthOfMonth()));
    }

    private LocalDate adjustedStart(LocalDate scheduledStart, boolean adjust) {
        if (!adjust) return scheduledStart;
        LocalDate date = scheduledStart;
        while (true) {
            if (date.getYear() < 2028 && !holidayCoverageDao.existsById((short) date.getYear())) {
                throw new BusinessRuleException("月度開始日の祝日データが不足しています: " + date.getYear());
            }
            DayOfWeek day = date.getDayOfWeek();
            if (day != DayOfWeek.SATURDAY && day != DayOfWeek.SUNDAY && !holidayDao.existsById(date.toString())) {
                return date;
            }
            date = date.minusDays(1);
        }
    }
}
