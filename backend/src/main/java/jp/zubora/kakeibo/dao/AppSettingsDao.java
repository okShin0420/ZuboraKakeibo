package jp.zubora.kakeibo.dao;

import org.springframework.data.jpa.repository.JpaRepository;

import jp.zubora.kakeibo.entity.AppSettingsEntity;

public interface AppSettingsDao extends JpaRepository<AppSettingsEntity, Short> {
}
