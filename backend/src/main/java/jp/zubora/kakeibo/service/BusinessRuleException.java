package jp.zubora.kakeibo.service;

public class BusinessRuleException extends IllegalStateException {
    public BusinessRuleException(String message) {
        super(message);
    }
}
