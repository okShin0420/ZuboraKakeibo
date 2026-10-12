package jp.zubora.kakeibo.dao;

import java.time.LocalDate;

public interface DailyExpenseTotalProjection {
    LocalDate getSpentOn();
    long getTotalAmount();
}
