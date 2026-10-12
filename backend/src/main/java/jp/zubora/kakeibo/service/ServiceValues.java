package jp.zubora.kakeibo.service;

import java.time.LocalDate;

import jp.zubora.kakeibo.dto.result.ExpenseResult;
import jp.zubora.kakeibo.dto.result.PeriodRangeResult;
import jp.zubora.kakeibo.entity.BudgetPeriodEntity;
import jp.zubora.kakeibo.entity.ExpenseEntity;

final class ServiceValues {
    private ServiceValues() {}

    static LocalDate date(LocalDate date) {
        if (date == null) throw new IllegalArgumentException("日付を指定してください");
        return date;
    }

    static void amount(long amount) {
        if (amount < 1 || amount > 999_999_999) {
            throw new IllegalArgumentException("金額は1〜999,999,999円で入力してください");
        }
    }

    static String memo(String memo) {
        if (memo == null) return null;
        if (memo.length() > 120) {
            throw new IllegalArgumentException("メモは120文字以内で入力してください");
        }
        return memo.isBlank() ? null : memo;
    }

    static PeriodRangeResult range(BudgetPeriodEntity period) {
        return new PeriodRangeResult(period.getLabelMonth(), period.getStartDate(),
                period.getNominalEndDate(), period.getEndDate());
    }

    static ExpenseResult expense(ExpenseEntity expense) {
        return new ExpenseResult(expense.getId(), expense.getBudgetPeriodId(), expense.getSpentOn(),
                expense.getAmount(), expense.getMemo(), expense.getCreatedAt(), expense.getUpdatedAt());
    }
}
