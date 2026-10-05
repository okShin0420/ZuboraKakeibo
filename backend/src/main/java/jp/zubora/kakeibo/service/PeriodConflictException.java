package jp.zubora.kakeibo.service;

public class PeriodConflictException extends RuntimeException {
    public PeriodConflictException(String message) {
        super(message);
    }
}
