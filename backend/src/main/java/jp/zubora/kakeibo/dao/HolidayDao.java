package jp.zubora.kakeibo.dao;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import jp.zubora.kakeibo.entity.HolidayEntity;

public interface HolidayDao extends JpaRepository<HolidayEntity, String> {
    List<HolidayEntity> findAllByCalendarYearOrderByHolidayDateAsc(Short calendarYear);
}
