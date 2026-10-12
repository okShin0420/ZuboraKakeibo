package jp.zubora.kakeibo.dto;

import java.time.LocalDate;

public record DailyExpenseTotal(
        LocalDate date,
        long totalAmount
) {
}
