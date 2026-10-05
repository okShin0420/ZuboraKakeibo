package jp.zubora.kakeibo.controller;

import jp.zubora.kakeibo.dto.BudgetResponse;
import jp.zubora.kakeibo.dto.ExpenseResponse;
import jp.zubora.kakeibo.dto.PeriodRangeResponse;
import jp.zubora.kakeibo.dto.SettingsResponse;
import jp.zubora.kakeibo.dto.result.BudgetResult;
import jp.zubora.kakeibo.dto.result.ExpenseResult;
import jp.zubora.kakeibo.dto.result.PeriodRangeResult;
import jp.zubora.kakeibo.dto.result.SettingsResult;

final class ResponseMapper {
    private ResponseMapper() {}

    static ExpenseResponse expense(ExpenseResult result) {
        return new ExpenseResponse(result.id(), result.budgetPeriodId(), result.spentOn(),
                result.amount(), result.memo(), result.createdAt(), result.updatedAt());
    }

    static BudgetResponse budget(BudgetResult result) {
        return new BudgetResponse(result.budgetPeriodId(), result.labelMonth(), result.budgetAmount(),
                result.remainingAmount(), result.updatedAt());
    }

    static SettingsResponse settings(SettingsResult result) {
        return new SettingsResponse(result.monthlyNotificationEnabled(), result.timezone(), result.startDay(),
                result.adjustForWeekendsAndHolidays(), result.currentBudgetAmount(),
                range(result.currentPeriodRange()), range(result.nextPeriodRange()));
    }

    private static PeriodRangeResponse range(PeriodRangeResult result) {
        return new PeriodRangeResponse(result.labelMonth(), result.startDate(), result.endDate());
    }
}
