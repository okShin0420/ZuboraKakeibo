package jp.zubora.kakeibo.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityManager;

import jp.zubora.kakeibo.dao.AppSettingsDao;
import jp.zubora.kakeibo.dao.BudgetCycleRuleDao;
import jp.zubora.kakeibo.dao.BudgetPeriodDao;
import jp.zubora.kakeibo.dto.command.UpdateSettingsCommand;
import jp.zubora.kakeibo.dto.result.PeriodRangeResult;
import jp.zubora.kakeibo.dto.result.SettingsResult;
import jp.zubora.kakeibo.entity.AppSettingsEntity;
import jp.zubora.kakeibo.entity.BudgetCycleRuleEntity;
import jp.zubora.kakeibo.entity.BudgetPeriodEntity;

@Service
public class SettingsService {
    private static final short SETTINGS_ID = 1;
    private final AppSettingsDao settingsDao;
    private final BudgetCycleRuleDao ruleDao;
    private final BudgetPeriodDao periodDao;
    private final BudgetPeriodService periodService;
    private final Clock clock;
    private final JdbcTemplate jdbc;
    private final EntityManager entityManager;
    private final PeriodProvisioningService provisioning;

    public SettingsService(AppSettingsDao settingsDao, BudgetCycleRuleDao ruleDao,
                           BudgetPeriodDao periodDao, BudgetPeriodService periodService, Clock clock,
                           JdbcTemplate jdbc, EntityManager entityManager, PeriodProvisioningService provisioning) {
        this.settingsDao = settingsDao;
        this.ruleDao = ruleDao;
        this.periodDao = periodDao;
        this.periodService = periodService;
        this.clock = clock;
        this.jdbc = jdbc;
        this.entityManager = entityManager;
        this.provisioning = provisioning;
    }

    @Transactional
    public SettingsResult getSettings(LocalDate asOf) {
        ServiceValues.date(asOf);
        provisioning.ensureDate(asOf);
        AppSettingsEntity settings = settingsDao.findById(SETTINGS_ID)
                .orElseThrow(() -> new ResourceNotFoundException("設定が見つかりません"));
        BudgetCycleRuleEntity rule = ruleDao.findEffectiveAt(asOf)
                .orElseThrow(() -> new ResourceNotFoundException("月度のルールが見つかりません"));
        BudgetPeriodEntity current = periodDao.findContainingDate(asOf)
                .orElseThrow(() -> new ResourceNotFoundException("進行中の月度が見つかりません"));
        YearMonth nextMonth = YearMonth.from(current.getLabelMonth()).plusMonths(1);
        BudgetPeriodEntity nextPeriod = periodDao.findByLabelMonth(nextMonth.atDay(1)).orElse(null);
        PeriodRangeResult nextRange = java.util.Optional.ofNullable(nextPeriod)
                .map(ServiceValues::range)
                .orElseGet(() -> {
                    BudgetCycleRuleEntity nextRule = ruleDao.findEffectiveAt(current.getEndDate().plusDays(1))
                            .orElse(rule);
                    return periodService.calculatePeriod(nextMonth, nextRule);
                });
        return new SettingsResult(settings.isMonthlyNotificationEnabled(), settings.getTimezone(),
                rule.getStartDay(), rule.isAdjustForWeekendsAndHolidays(), current.getBudgetAmount(),
                ServiceValues.range(current), nextRange);
    }

    @Transactional
    public SettingsResult updateSettings(UpdateSettingsCommand command) {
        Objects.requireNonNull(command, "command");
        if (command.startDay() < 1 || command.startDay() > 31) {
            throw new IllegalArgumentException("月度の開始日は1〜31日で指定してください");
        }
        LocalDate asOf = LocalDate.now(clock);
        provisioning.ensureDate(asOf);
        AppSettingsEntity settings = settingsDao.findById(SETTINGS_ID)
                .orElseThrow(() -> new ResourceNotFoundException("設定が見つかりません"));
        BudgetCycleRuleEntity currentRule = ruleDao.findEffectiveAt(asOf)
                .orElseThrow(() -> new ResourceNotFoundException("月度のルールが見つかりません"));
        boolean ruleChanged = currentRule.getStartDay() != command.startDay()
                || currentRule.isAdjustForWeekendsAndHolidays() != command.adjustForWeekendsAndHolidays();

        if (ruleChanged) {
            reconfigureAll(command, asOf);
        }

        settings.setMonthlyNotificationEnabled(command.monthlyNotificationEnabled());
        settings.setUpdatedAt(clock.instant());
        settingsDao.save(settings);
        return getSettings(asOf);
    }

    private void reconfigureAll(UpdateSettingsCommand command, LocalDate asOf) {
        List<BudgetPeriodEntity> existing = periodDao.findAll().stream()
                .sorted(Comparator.comparing(BudgetPeriodEntity::getLabelMonth)).toList();
        if (existing.isEmpty()) throw new ResourceNotFoundException("月度が見つかりません");
        Map<LocalDate, BudgetPeriodEntity> byLabel = new HashMap<>();
        for (BudgetPeriodEntity period : existing) byLabel.put(period.getLabelMonth(), period);

        BudgetCycleRuleEntity replacement = new BudgetCycleRuleEntity();
        replacement.setStartDay(command.startDay());
        replacement.setAdjustForWeekendsAndHolidays(command.adjustForWeekendsAndHolidays());
        YearMonth first = YearMonth.from(existing.get(0).getLabelMonth());
        YearMonth last = YearMonth.from(existing.get(existing.size() - 1).getLabelMonth());
        List<PeriodRangeResult> ranges = new ArrayList<>();
        for (YearMonth month = first; !month.isAfter(last); month = month.plusMonths(1)) {
            ranges.add(periodService.calculatePeriod(month, replacement));
        }
        String earliestExpense = jdbc.queryForObject("SELECT MIN(spent_on) FROM expenses", String.class);
        String latestExpense = jdbc.queryForObject("SELECT MAX(spent_on) FROM expenses", String.class);
        LocalDate earliestNeeded = earliestExpense == null ? asOf :
                asOf.isBefore(LocalDate.parse(earliestExpense)) ? asOf : LocalDate.parse(earliestExpense);
        LocalDate latestNeeded = latestExpense == null ? asOf :
                asOf.isAfter(LocalDate.parse(latestExpense)) ? asOf : LocalDate.parse(latestExpense);
        while (earliestNeeded.isBefore(ranges.get(0).startDate())) {
            ranges.add(0, periodService.calculatePeriod(YearMonth.from(ranges.get(0).labelMonth()).minusMonths(1), replacement));
        }
        while (latestNeeded.isAfter(ranges.get(ranges.size() - 1).endDate())) {
            ranges.add(periodService.calculatePeriod(
                    YearMonth.from(ranges.get(ranges.size() - 1).labelMonth()).plusMonths(1), replacement));
        }
        for (int i = 1; i < ranges.size(); i++) {
            if (!ranges.get(i - 1).endDate().plusDays(1).equals(ranges.get(i).startDate())) {
                throw new PeriodConflictException("月度の境界に空白または重複があります");
            }
        }

        String timestamp = clock.instant().toString();
        UUID retainedRuleId = existing.get(0).getCycleRuleId();
        entityManager.flush();
        jdbc.update("UPDATE budget_periods SET cycle_rule_id = ? WHERE cycle_rule_id <> ?",
                retainedRuleId.toString(), retainedRuleId.toString());
        jdbc.update("DELETE FROM budget_cycle_rules WHERE id <> ?", retainedRuleId.toString());
        jdbc.update("""
                UPDATE budget_cycle_rules SET start_day = ?, adjust_for_weekends_and_holidays = ?,
                effective_from = ?, effective_to = NULL, updated_at = ? WHERE id = ?
                """, command.startDay(), command.adjustForWeekendsAndHolidays() ? 1 : 0,
                ranges.get(0).startDate().toString(), timestamp, retainedRuleId.toString());
        for (PeriodRangeResult range : ranges) {
            BudgetPeriodEntity period = byLabel.get(range.labelMonth());
            if (period == null) continue;
            jdbc.update("""
                    UPDATE budget_periods SET cycle_rule_id = ?, start_date = ?, nominal_end_date = ?, end_date = ?, updated_at = ?
                    WHERE id = ?
                    """, retainedRuleId.toString(), range.startDate().toString(), range.nominalEndDate().toString(),
                    range.endDate().toString(), timestamp, period.getId().toString());
        }
        for (PeriodRangeResult range : ranges) {
            if (!byLabel.containsKey(range.labelMonth())) insertZeroBudgetPeriod(range, retainedRuleId, timestamp);
        }
        Integer uncovered = jdbc.queryForObject("""
                SELECT COUNT(*) FROM expenses e LEFT JOIN budget_periods p
                ON e.spent_on BETWEEN p.start_date AND p.end_date WHERE p.id IS NULL
                """, Integer.class);
        if (uncovered != null && uncovered > 0) {
            throw new PeriodConflictException("支出の日付に対応する月度がありません");
        }
        jdbc.update("""
                UPDATE expenses SET budget_period_id =
                (SELECT p.id FROM budget_periods p WHERE expenses.spent_on BETWEEN p.start_date AND p.end_date LIMIT 1)
                WHERE budget_period_id <> (SELECT p.id FROM budget_periods p
                WHERE expenses.spent_on BETWEEN p.start_date AND p.end_date LIMIT 1)
                """);
        entityManager.clear();
    }

    private void insertZeroBudgetPeriod(PeriodRangeResult range, UUID ruleId, String timestamp) {
        jdbc.update("""
                INSERT INTO budget_periods
                (id, cycle_rule_id, label_month, start_date, nominal_end_date, end_date, budget_amount, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
                """, UUID.randomUUID().toString(), ruleId.toString(), range.labelMonth().toString(),
                range.startDate().toString(), range.nominalEndDate().toString(), range.endDate().toString(),
                timestamp, timestamp);
    }
}
