package jp.zubora.kakeibo.dto;

import java.time.Instant;
import java.util.Map;

public record ErrorResponse(
        String code,
        String message,
        Map<String, String> fieldErrors,
        Instant timestamp
) {
}
