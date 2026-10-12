package jp.zubora.kakeibo.dto.command;

import java.time.LocalDate;

public record CreateExpenseCommand(LocalDate spentOn, long amount, String memo) {
}
