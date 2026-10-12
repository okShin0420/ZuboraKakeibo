package jp.zubora.kakeibo.dto;

public record SettingsResponse(
        boolean monthlyNotificationEnabled,
        String timezone,
        int startDay,
        boolean adjustForWeekendsAndHolidays,
        long currentBudgetAmount,
        PeriodRangeResponse currentPeriodRange,
        PeriodRangeResponse nextPeriodRange
) {
}
