package jp.zubora.kakeibo.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record UpdateBudgetRequest(
        @NotNull LocalDate asOf,
        @NotNull @Min(1) @Max(999_999_999) Long amount
) {
}
