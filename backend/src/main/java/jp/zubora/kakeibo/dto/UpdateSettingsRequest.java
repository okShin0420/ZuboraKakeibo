package jp.zubora.kakeibo.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record UpdateSettingsRequest(
        @NotNull Boolean monthlyNotificationEnabled,
        @NotNull @Min(1) @Max(31) Integer startDay,
        @NotNull Boolean adjustForWeekendsAndHolidays
) {
}
