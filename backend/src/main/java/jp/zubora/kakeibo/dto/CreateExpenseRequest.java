package jp.zubora.kakeibo.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateExpenseRequest(
        @NotNull LocalDate spentOn,
        @NotNull @Min(1) @Max(999_999_999) Long amount,
        @Size(max = 120) String memo
) {
}
