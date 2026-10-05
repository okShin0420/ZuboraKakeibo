package jp.zubora.kakeibo.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jp.zubora.kakeibo.dao.BudgetPeriodDao;
import jp.zubora.kakeibo.dao.ExpenseDao;
import jp.zubora.kakeibo.dto.command.CreateExpenseCommand;
import jp.zubora.kakeibo.dto.command.UpdateExpenseCommand;
import jp.zubora.kakeibo.dto.result.ExpenseResult;
import jp.zubora.kakeibo.entity.BudgetPeriodEntity;
import jp.zubora.kakeibo.entity.ExpenseEntity;

@Service
public class ExpenseService {
    private final ExpenseDao expenseDao;
    private final BudgetPeriodDao periodDao;
    private final Clock clock;

    public ExpenseService(ExpenseDao expenseDao, BudgetPeriodDao periodDao, Clock clock) {
        this.expenseDao = expenseDao;
        this.periodDao = periodDao;
        this.clock = clock;
    }

    @Transactional
    public ExpenseResult createExpense(CreateExpenseCommand command) {
        Objects.requireNonNull(command, "command");
        ServiceValues.date(command.spentOn());
        ServiceValues.amount(command.amount());
        String memo = ServiceValues.memo(command.memo());
        BudgetPeriodEntity period = periodFor(command.spentOn());
        Instant now = clock.instant();
        ExpenseEntity expense = new ExpenseEntity();
        expense.setId(UUID.randomUUID());
        expense.setBudgetPeriodId(period.getId());
        expense.setSpentOn(command.spentOn());
        expense.setAmount(command.amount());
        expense.setMemo(memo);
        expense.setCreatedAt(now);
        expense.setUpdatedAt(now);
        return ServiceValues.expense(expenseDao.save(expense));
    }

    @Transactional
    public ExpenseResult updateExpense(UUID expenseId, UpdateExpenseCommand command) {
        Objects.requireNonNull(expenseId, "expenseId");
        Objects.requireNonNull(command, "command");
        ServiceValues.date(command.spentOn());
        ServiceValues.amount(command.amount());
        String memo = ServiceValues.memo(command.memo());
        ExpenseEntity expense = expenseDao.findById(expenseId)
                .orElseThrow(() -> new ResourceNotFoundException("支出が見つかりません"));
        BudgetPeriodEntity period = periodFor(command.spentOn());
        expense.setBudgetPeriodId(period.getId());
        expense.setSpentOn(command.spentOn());
        expense.setAmount(command.amount());
        expense.setMemo(memo);
        expense.setUpdatedAt(clock.instant());
        return ServiceValues.expense(expenseDao.save(expense));
    }

    private BudgetPeriodEntity periodFor(LocalDate date) {
        return periodDao.findContainingDate(date)
                .orElseThrow(() -> new ResourceNotFoundException("支出日に対応する月度が見つかりません"));
    }
}
