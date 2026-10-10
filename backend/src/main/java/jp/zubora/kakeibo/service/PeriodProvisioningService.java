package jp.zubora.kakeibo.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jp.zubora.kakeibo.dao.BudgetCycleRuleDao;
import jp.zubora.kakeibo.dao.BudgetPeriodDao;
import jp.zubora.kakeibo.dto.result.PeriodRangeResult;
import jp.zubora.kakeibo.entity.BudgetCycleRuleEntity;
import jp.zubora.kakeibo.entity.BudgetPeriodEntity;

/** Creates unconfigured months only when a screen or expense needs them. */
@Service
public class PeriodProvisioningService {
    private final BudgetPeriodDao periodDao;
    private final BudgetCycleRuleDao ruleDao;
    private final BudgetPeriodService periodService;
    private final Clock clock;

    public PeriodProvisioningService(BudgetPeriodDao periodDao, BudgetCycleRuleDao ruleDao,
                                     BudgetPeriodService periodService, Clock clock) {
        this.periodDao = periodDao;
        this.ruleDao = ruleDao;
        this.periodService = periodService;
        this.clock = clock;
    }

    @Transactional
    public BudgetPeriodEntity ensureDate(LocalDate date) {
        ServiceValues.date(date);
        BudgetPeriodEntity found = periodDao.findContainingDate(date).orElse(null);
        if (found != null) return found;
        List<BudgetPeriodEntity> periods = sortedPeriods();
        if (date.isBefore(periods.get(0).getStartDate())) {
            BudgetPeriodEntity first = periods.get(0);
            while (date.isBefore(first.getStartDate())) first = addAdjacent(first, -1);
        } else {
            BudgetPeriodEntity last = periods.get(periods.size() - 1);
            while (date.isAfter(last.getEndDate())) last = addAdjacent(last, 1);
        }
        return periodDao.findContainingDate(date)
                .orElseThrow(() -> new PeriodConflictException("対象日に対応する月度がありません"));
    }

    @Transactional
    public BudgetPeriodEntity ensureMonth(YearMonth month) {
        BudgetPeriodEntity found = periodDao.findByLabelMonth(month.atDay(1)).orElse(null);
        if (found != null) return found;
        List<BudgetPeriodEntity> periods = sortedPeriods();
        BudgetPeriodEntity edge = month.isBefore(YearMonth.from(periods.get(0).getLabelMonth()))
                ? periods.get(0) : periods.get(periods.size() - 1);
        int direction = month.isBefore(YearMonth.from(edge.getLabelMonth())) ? -1 : 1;
        while (!edge.getLabelMonth().equals(month.atDay(1))) edge = addAdjacent(edge, direction);
        return edge;
    }

    private List<BudgetPeriodEntity> sortedPeriods() {
        List<BudgetPeriodEntity> periods = periodDao.findAll().stream()
                .sorted(Comparator.comparing(BudgetPeriodEntity::getLabelMonth)).toList();
        if (periods.isEmpty()) throw new ResourceNotFoundException("月度が見つかりません");
        return periods;
    }

    private BudgetPeriodEntity addAdjacent(BudgetPeriodEntity edge, int direction) {
        YearMonth month = YearMonth.from(edge.getLabelMonth()).plusMonths(direction);
        BudgetCycleRuleEntity rule = ruleDao.findById(edge.getCycleRuleId())
                .orElseThrow(() -> new ResourceNotFoundException("月度のルールが見つかりません"));
        PeriodRangeResult range = periodService.calculatePeriod(month, rule);
        if (direction < 0 && !range.endDate().plusDays(1).equals(edge.getStartDate())
                || direction > 0 && !edge.getEndDate().plusDays(1).equals(range.startDate())) {
            throw new PeriodConflictException("既存の月度境界に空白または重複があります");
        }
        periodService.assertNoOverlap(range, null);
        BudgetPeriodEntity period = new BudgetPeriodEntity();
        period.setId(UUID.randomUUID());
        period.setCycleRuleId(rule.getId());
        period.setLabelMonth(range.labelMonth());
        period.setStartDate(range.startDate());
        period.setNominalEndDate(range.nominalEndDate());
        period.setEndDate(range.endDate());
        period.setBudgetAmount(0);
        period.setCreatedAt(clock.instant());
        period.setUpdatedAt(period.getCreatedAt());
        if (direction < 0 && rule.getEffectiveFrom().isAfter(range.startDate())) {
            rule.setEffectiveFrom(range.startDate());
            rule.setUpdatedAt(clock.instant());
            ruleDao.save(rule);
        }
        return periodDao.saveAndFlush(period);
    }
}
