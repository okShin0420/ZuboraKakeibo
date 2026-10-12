package jp.zubora.kakeibo.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jp.zubora.kakeibo.dao.BudgetPeriodDao;
import jp.zubora.kakeibo.dto.MonthlyBudgetSummary;
import jp.zubora.kakeibo.dto.result.YearlyBudgetSummaryResult;
import jp.zubora.kakeibo.entity.BudgetPeriodSummaryEntity;

@Service
@Transactional(readOnly = true)
public class GraphService {
    private final BudgetPeriodDao periodDao;

    public GraphService(BudgetPeriodDao periodDao) {
        this.periodDao = periodDao;
    }

    public YearlyBudgetSummaryResult getYearlySummary(int year) {
        if (year < 1 || year > 9999) {
            throw new IllegalArgumentException("年は1〜9999で指定してください");
        }
        Map<Integer, BudgetPeriodSummaryEntity> byMonth = periodDao.findSummariesByLabelMonthBetween(
                LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 1))
                .stream().collect(Collectors.toMap(row -> row.getLabelMonth().getMonthValue(), Function.identity()));
        List<MonthlyBudgetSummary> months = new ArrayList<>(12);
        for (int month = 1; month <= 12; month++) {
            BudgetPeriodSummaryEntity row = byMonth.get(month);
            months.add(row == null ? new MonthlyBudgetSummary(month, 0, 0, 0, 0)
                    : new MonthlyBudgetSummary(month, row.getBudgetAmount(), row.getSpentAmount(),
                            row.getRemainingAmount(), row.getExpenseCount()));
        }
        return new YearlyBudgetSummaryResult(year, periodDao.findDistinctLabelYears(), months);
    }
}
