package jp.zubora.kakeibo.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record SetupRequest(@NotNull @Min(1) @Max(999_999_999) Long budgetAmount) {
}
