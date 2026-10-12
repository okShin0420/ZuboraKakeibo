package jp.zubora.kakeibo.dto.command;

import java.time.LocalDate;

public record UpdateExpenseCommand(LocalDate spentOn, long amount, String memo) {
}
