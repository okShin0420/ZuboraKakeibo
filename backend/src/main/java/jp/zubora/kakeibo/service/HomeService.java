package jp.zubora.kakeibo.service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jp.zubora.kakeibo.dao.BudgetPeriodDao;
import jp.zubora.kakeibo.dao.ExpenseDao;
import jp.zubora.kakeibo.dto.result.HomeResult;
import jp.zubora.kakeibo.entity.BudgetPeriodSummaryEntity;

@Service
@Transactional(readOnly = true)
public class HomeService {
    private final BudgetPeriodDao periodDao;
    private final ExpenseDao expenseDao;

    public HomeService(BudgetPeriodDao periodDao, ExpenseDao expenseDao) {
        this.periodDao = periodDao;
        this.expenseDao = expenseDao;
    }

    public HomeResult getHome(LocalDate asOf) {
        ServiceValues.date(asOf);
        BudgetPeriodSummaryEntity summary = periodDao.findSummaryContaining(asOf)
                .orElseThrow(() -> new ResourceNotFoundException("対象日の月度が見つかりません"));
        int remainingDays = Math.toIntExact(ChronoUnit.DAYS.between(asOf, summary.getEndDate()) + 1);
        return new HomeResult(summary.getLabelMonth(), summary.getBudgetAmount(), summary.getSpentAmount(),
                summary.getRemainingAmount(), expenseDao.sumAmountBySpentOn(asOf), remainingDays,
                "今日も、自分のペースで。");
    }
}
