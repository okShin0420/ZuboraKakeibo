package jp.zubora.kakeibo.entity.converter;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class BooleanIntegerConverter implements AttributeConverter<Boolean, Integer> {
    @Override
    public Integer convertToDatabaseColumn(Boolean value) {
        return Boolean.TRUE.equals(value) ? 1 : 0;
    }

    @Override
    public Boolean convertToEntityAttribute(Integer value) {
        return value != null && value != 0;
    }
}
