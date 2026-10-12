package jp.zubora.kakeibo.service;

import java.time.Clock;
import java.time.LocalDate;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jp.zubora.kakeibo.dao.BudgetPeriodDao;
import jp.zubora.kakeibo.dto.result.BudgetResult;
import jp.zubora.kakeibo.entity.BudgetPeriodEntity;
import jp.zubora.kakeibo.entity.BudgetPeriodSummaryEntity;

@Service
public class BudgetService {
    private final BudgetPeriodDao periodDao;
    private final Clock clock;
    private final PeriodProvisioningService provisioning;

    public BudgetService(BudgetPeriodDao periodDao, Clock clock, PeriodProvisioningService provisioning) {
        this.periodDao = periodDao;
        this.clock = clock;
        this.provisioning = provisioning;
    }

    @Transactional
    public BudgetResult getCurrentBudget(LocalDate asOf) {
        BudgetPeriodEntity period = periodFor(ServiceValues.date(asOf));
        BudgetPeriodSummaryEntity summary = summaryFor(asOf);
        return new BudgetResult(period.getId(), period.getLabelMonth(), period.getBudgetAmount(),
                summary.getRemainingAmount(), period.getUpdatedAt());
    }

    @Transactional
    public BudgetResult updateCurrentBudget(LocalDate asOf, long amount) {
        ServiceValues.date(asOf);
        ServiceValues.amount(amount);
        BudgetPeriodEntity period = periodFor(asOf);
        long spent = summaryFor(asOf).getSpentAmount();
        period.setBudgetAmount(amount);
        period.setUpdatedAt(clock.instant());
        periodDao.save(period);
        return new BudgetResult(period.getId(), period.getLabelMonth(), amount, amount - spent,
                period.getUpdatedAt());
    }

    private BudgetPeriodEntity periodFor(LocalDate asOf) {
        provisioning.ensureDate(asOf);
        return periodDao.findContainingDate(asOf)
                .orElseThrow(() -> new ResourceNotFoundException("対象日の月度が見つかりません"));
    }

    private BudgetPeriodSummaryEntity summaryFor(LocalDate asOf) {
        return periodDao.findSummaryContaining(asOf)
                .orElseThrow(() -> new ResourceNotFoundException("対象日の予算集計が見つかりません"));
    }
}
