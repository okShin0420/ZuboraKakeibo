package jp.zubora.kakeibo.dto.command;

public record UpdateSettingsCommand(
        boolean monthlyNotificationEnabled,
        int startDay,
        boolean adjustForWeekendsAndHolidays
) {
}
