package jp.zubora.kakeibo.dto.result;

public record SettingsResult(
        boolean monthlyNotificationEnabled,
        String timezone,
        int startDay,
        boolean adjustForWeekendsAndHolidays,
        long currentBudgetAmount,
        PeriodRangeResult currentPeriodRange,
        PeriodRangeResult nextPeriodRange
) {
}
