package jp.zubora.kakeibo.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jp.zubora.kakeibo.dao.AppSettingsDao;
import jp.zubora.kakeibo.dao.BudgetCycleRuleDao;
import jp.zubora.kakeibo.dao.BudgetPeriodDao;
import jp.zubora.kakeibo.dto.result.PeriodRangeResult;
import jp.zubora.kakeibo.dto.result.SettingsResult;
import jp.zubora.kakeibo.entity.AppSettingsEntity;
import jp.zubora.kakeibo.entity.BudgetCycleRuleEntity;
import jp.zubora.kakeibo.entity.BudgetPeriodEntity;

@Service
public class SetupService {
    private final AppSettingsDao settingsDao;
    private final BudgetCycleRuleDao ruleDao;
    private final BudgetPeriodDao periodDao;
    private final BudgetPeriodService periodService;
    private final SettingsService settingsService;
    private final Clock clock;

    public SetupService(AppSettingsDao settingsDao, BudgetCycleRuleDao ruleDao, BudgetPeriodDao periodDao,
                        BudgetPeriodService periodService, SettingsService settingsService, Clock clock) {
        this.settingsDao = settingsDao;
        this.ruleDao = ruleDao;
        this.periodDao = periodDao;
        this.periodService = periodService;
        this.settingsService = settingsService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public boolean isInitialized() {
        return settingsDao.existsById((short) 1);
    }

    @Transactional
    public SettingsResult setup(long budgetAmount) {
        ServiceValues.amount(budgetAmount);
        if (settingsDao.existsById((short) 1) || ruleDao.count() != 0 || periodDao.count() != 0) {
            throw new PeriodConflictException("初期設定は完了しています");
        }
        LocalDate today = LocalDate.now(clock);
        Instant now = clock.instant();

        AppSettingsEntity settings = new AppSettingsEntity();
        settings.setId((short) 1);
        settings.setMonthlyNotificationEnabled(true);
        settings.setTimezone("Asia/Tokyo");
        settings.setCreatedAt(now);
        settings.setUpdatedAt(now);
        settingsDao.save(settings);

        BudgetCycleRuleEntity rule = new BudgetCycleRuleEntity();
        rule.setId(UUID.randomUUID());
        rule.setStartDay(1);
        rule.setAdjustForWeekendsAndHolidays(false);
        PeriodRangeResult range = periodService.calculatePeriod(YearMonth.from(today), rule);
        rule.setEffectiveFrom(range.startDate());
        rule.setCreatedAt(now);
        rule.setUpdatedAt(now);
        ruleDao.save(rule);

        BudgetPeriodEntity period = new BudgetPeriodEntity();
        period.setId(UUID.randomUUID());
        period.setCycleRuleId(rule.getId());
        period.setLabelMonth(range.labelMonth());
        period.setStartDate(range.startDate());
        period.setNominalEndDate(range.nominalEndDate());
        period.setEndDate(range.endDate());
        period.setBudgetAmount(budgetAmount);
        period.setCreatedAt(now);
        period.setUpdatedAt(now);
        periodDao.save(period);
        return settingsService.getSettings(today);
    }
}
