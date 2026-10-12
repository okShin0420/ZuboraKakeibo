package jp.zubora.kakeibo.dao;

import org.springframework.data.jpa.repository.JpaRepository;

import jp.zubora.kakeibo.entity.HolidayCalendarCoverageEntity;

public interface HolidayCoverageDao extends JpaRepository<HolidayCalendarCoverageEntity, Short> {
}
