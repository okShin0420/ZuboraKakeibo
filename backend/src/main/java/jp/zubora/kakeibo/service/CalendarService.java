package jp.zubora.kakeibo.service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Objects;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jp.zubora.kakeibo.dao.BudgetPeriodDao;
import jp.zubora.kakeibo.dao.ExpenseDao;
import jp.zubora.kakeibo.dto.DailyExpenseTotal;
import jp.zubora.kakeibo.dto.result.CalendarMonthResult;
import jp.zubora.kakeibo.dto.result.DailyExpensesResult;
import jp.zubora.kakeibo.dto.result.ExpenseResult;
import jp.zubora.kakeibo.entity.BudgetPeriodEntity;

@Service
@Transactional(readOnly = true)
public class CalendarService {
    private final BudgetPeriodDao periodDao;
    private final ExpenseDao expenseDao;
    private final PeriodProvisioningService provisioning;

    public CalendarService(BudgetPeriodDao periodDao, ExpenseDao expenseDao, PeriodProvisioningService provisioning) {
        this.periodDao = periodDao;
        this.expenseDao = expenseDao;
        this.provisioning = provisioning;
    }

    @Transactional(readOnly = false)
    public CalendarMonthResult getMonthlyCalendar(YearMonth month) {
        Objects.requireNonNull(month, "month");
        BudgetPeriodEntity period = provisioning.ensureMonth(month);
        List<DailyExpenseTotal> totals = expenseDao.sumAmountByDateRange(period.getStartDate(), period.getEndDate())
                .stream().map(row -> new DailyExpenseTotal(row.getSpentOn(), row.getTotalAmount())).toList();
        return new CalendarMonthResult(month, period.getStartDate(), period.getEndDate(), totals);
    }

    public DailyExpensesResult getDailyExpenses(LocalDate date) {
        ServiceValues.date(date);
        List<ExpenseResult> expenses = expenseDao.findAllBySpentOnOrderByCreatedAtAsc(date)
                .stream().map(ServiceValues::expense).toList();
        long total = expenses.stream().mapToLong(ExpenseResult::amount).sum();
        return new DailyExpensesResult(date, total, expenses);
    }
}
