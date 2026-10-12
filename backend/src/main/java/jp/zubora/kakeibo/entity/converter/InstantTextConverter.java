package jp.zubora.kakeibo.entity.converter;

import java.time.Instant;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class InstantTextConverter implements AttributeConverter<Instant, String> {
    @Override
    public String convertToDatabaseColumn(Instant value) {
        return value == null ? null : value.toString();
    }

    @Override
    public Instant convertToEntityAttribute(String value) {
        return value == null ? null : Instant.parse(value);
    }
}
