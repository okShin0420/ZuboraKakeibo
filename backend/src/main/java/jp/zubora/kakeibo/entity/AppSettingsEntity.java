package jp.zubora.kakeibo.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "app_settings")
public class AppSettingsEntity {
    @Id
    private Short id;
    @Column(name = "monthly_notification_enabled", nullable = false)
    private boolean monthlyNotificationEnabled;
    @Column(nullable = false, length = 64)
    private String timezone;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public AppSettingsEntity() {}

    public Short getId() { return id; }
    public void setId(Short id) { this.id = id; }
    public boolean isMonthlyNotificationEnabled() { return monthlyNotificationEnabled; }
    public void setMonthlyNotificationEnabled(boolean value) { this.monthlyNotificationEnabled = value; }
    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
