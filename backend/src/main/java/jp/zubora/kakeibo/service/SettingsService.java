package jp.zubora.kakeibo.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Objects;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    public SettingsService(AppSettingsDao settingsDao, BudgetCycleRuleDao ruleDao,
                           BudgetPeriodDao periodDao, BudgetPeriodService periodService, Clock clock) {
        this.settingsDao = settingsDao;
        this.ruleDao = ruleDao;
        this.periodDao = periodDao;
        this.periodService = periodService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public SettingsResult getSettings(LocalDate asOf) {
        ServiceValues.date(asOf);
        AppSettingsEntity settings = settingsDao.findById(SETTINGS_ID)
                .orElseThrow(() -> new ResourceNotFoundException("設定が見つかりません"));
        BudgetCycleRuleEntity rule = ruleDao.findEffectiveAt(asOf)
                .orElseThrow(() -> new ResourceNotFoundException("月度のルールが見つかりません"));
        BudgetPeriodEntity current = periodDao.findContainingDate(asOf)
                .orElseThrow(() -> new ResourceNotFoundException("進行中の月度が見つかりません"));
        YearMonth nextMonth = YearMonth.from(current.getLabelMonth()).plusMonths(1);
        BudgetPeriodEntity nextPeriod = periodDao.findByLabelMonth(nextMonth.atDay(1)).orElse(null);
        BudgetCycleRuleEntity displayedRule = nextPeriod == null ? rule : ruleDao.findById(nextPeriod.getCycleRuleId())
                .orElseThrow(() -> new ResourceNotFoundException("次月度のルールが見つかりません"));
        PeriodRangeResult nextRange = java.util.Optional.ofNullable(nextPeriod)
                .map(ServiceValues::range)
                .orElseGet(() -> {
                    BudgetCycleRuleEntity nextRule = ruleDao.findEffectiveAt(current.getEndDate().plusDays(1))
                            .orElse(rule);
                    return periodService.calculatePeriod(nextMonth, nextRule);
                });
        return new SettingsResult(settings.isMonthlyNotificationEnabled(), settings.getTimezone(),
                displayedRule.getStartDay(), displayedRule.isAdjustForWeekendsAndHolidays(), current.getBudgetAmount(),
                ServiceValues.range(current), nextRange);
    }

    @Transactional
    public SettingsResult updateSettings(UpdateSettingsCommand command) {
        Objects.requireNonNull(command, "command");
        if (command.startDay() < 1 || command.startDay() > 31) {
            throw new IllegalArgumentException("月度の開始日は1〜31日で指定してください");
        }
        LocalDate asOf = LocalDate.now(clock);
        AppSettingsEntity settings = settingsDao.findById(SETTINGS_ID)
                .orElseThrow(() -> new ResourceNotFoundException("設定が見つかりません"));
        BudgetCycleRuleEntity currentRule = ruleDao.findEffectiveAt(asOf)
                .orElseThrow(() -> new ResourceNotFoundException("月度のルールが見つかりません"));
        BudgetPeriodEntity currentPeriod = periodDao.findContainingDate(asOf)
                .orElseThrow(() -> new ResourceNotFoundException("進行中の月度が見つかりません"));
        YearMonth nextMonth = YearMonth.from(currentPeriod.getLabelMonth()).plusMonths(1);
        BudgetPeriodEntity existingNext = periodDao.findByLabelMonth(nextMonth.atDay(1)).orElse(null);
        BudgetCycleRuleEntity configuredRule = existingNext == null ? currentRule
                : ruleDao.findById(existingNext.getCycleRuleId())
                        .orElseThrow(() -> new ResourceNotFoundException("次月度のルールが見つかりません"));
        boolean ruleChanged = configuredRule.getStartDay() != command.startDay()
                || configuredRule.isAdjustForWeekendsAndHolidays() != command.adjustForWeekendsAndHolidays();

        if (ruleChanged) {
            if (existingNext != null) {
                throw new PeriodConflictException("次月度のルールはすでに設定されています");
            }
            Instant now = clock.instant();
            BudgetCycleRuleEntity nextRule = new BudgetCycleRuleEntity();
            nextRule.setId(UUID.randomUUID());
            nextRule.setStartDay(command.startDay());
            nextRule.setAdjustForWeekendsAndHolidays(command.adjustForWeekendsAndHolidays());
            nextRule.setCreatedAt(now);
            nextRule.setUpdatedAt(now);
            LocalDate nextStart = periodService.calculatePeriod(nextMonth, nextRule).startDate();
            if (!nextStart.isAfter(asOf)) {
                throw new BusinessRuleException("次月度の開始日を過ぎているため、この月度には適用できません");
            }
            if (ruleDao.findOverlapping(nextStart, LocalDate.of(9999, 12, 31)).stream()
                    .anyMatch(rule -> !rule.getId().equals(currentRule.getId()))) {
                throw new PeriodConflictException("次月度以降のルールがすでに存在します");
            }
            nextRule.setEffectiveFrom(nextStart);
            currentRule.setEffectiveTo(nextStart.minusDays(1));
            currentRule.setUpdatedAt(now);
            ruleDao.saveAndFlush(currentRule);
            ruleDao.save(nextRule);
            periodService.applyNextPeriodRule(asOf, nextRule);
        }

        settings.setMonthlyNotificationEnabled(command.monthlyNotificationEnabled());
        settings.setUpdatedAt(clock.instant());
        settingsDao.save(settings);
        return getSettings(asOf);
    }
}
