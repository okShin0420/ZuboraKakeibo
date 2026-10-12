package jp.zubora.kakeibo.controller;

import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import jp.zubora.kakeibo.dto.ErrorResponse;
import jp.zubora.kakeibo.service.BusinessRuleException;
import jp.zubora.kakeibo.service.PeriodConflictException;
import jp.zubora.kakeibo.service.ResourceNotFoundException;

@RestControllerAdvice
public class ApiExceptionHandler {
    private static final Logger LOG = LoggerFactory.getLogger(ApiExceptionHandler.class);
    private final Clock clock;

    public ApiExceptionHandler(Clock clock) {
        this.clock = clock;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorResponse> validation(MethodArgumentNotValidException exception) {
        Map<String, String> fields = new LinkedHashMap<>();
        exception.getBindingResult().getFieldErrors().forEach(error ->
                fields.putIfAbsent(error.getField(), error.getDefaultMessage()));
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "入力内容を確認してください", fields);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ErrorResponse> typeMismatch(MethodArgumentTypeMismatchException exception) {
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "入力内容を確認してください",
                Map.of(exception.getName(), "形式が正しくありません"));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    ResponseEntity<ErrorResponse> missingParameter(MissingServletRequestParameterException exception) {
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "入力内容を確認してください",
                Map.of(exception.getParameterName(), "指定してください"));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ErrorResponse> unreadableBody(HttpMessageNotReadableException exception) {
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "リクエストの形式を確認してください", Map.of());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ErrorResponse> invalidValue(IllegalArgumentException exception) {
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", exception.getMessage(), Map.of());
    }

    @ExceptionHandler({ResourceNotFoundException.class, NoResourceFoundException.class})
    ResponseEntity<ErrorResponse> notFound(Exception exception) {
        return error(HttpStatus.NOT_FOUND, "NOT_FOUND", exception.getMessage(), Map.of());
    }

    @ExceptionHandler(PeriodConflictException.class)
    ResponseEntity<ErrorResponse> conflict(PeriodConflictException exception) {
        return error(HttpStatus.CONFLICT, "CONFLICT", exception.getMessage(), Map.of());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ErrorResponse> databaseConflict(DataIntegrityViolationException exception) {
        return error(HttpStatus.CONFLICT, "CONFLICT", "保存内容が既存データと競合しています", Map.of());
    }

    @ExceptionHandler(BusinessRuleException.class)
    ResponseEntity<ErrorResponse> businessRule(BusinessRuleException exception) {
        return error(HttpStatus.UNPROCESSABLE_ENTITY, "BUSINESS_RULE", exception.getMessage(), Map.of());
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorResponse> unexpected(Exception exception) {
        LOG.error("Unexpected API error", exception);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "処理を完了できませんでした", Map.of());
    }

    private ResponseEntity<ErrorResponse> error(HttpStatus status, String code, String message,
                                                Map<String, String> fields) {
        return ResponseEntity.status(status).body(new ErrorResponse(code, message, fields, clock.instant()));
    }
}
