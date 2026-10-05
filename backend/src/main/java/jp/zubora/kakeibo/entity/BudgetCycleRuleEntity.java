package jp.zubora.kakeibo.entity;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "budget_cycle_rules")
public class BudgetCycleRuleEntity {
    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private UUID id;
    @Column(name = "start_day", nullable = false)
    private int startDay;
    @Column(name = "adjust_for_weekends_and_holidays", nullable = false)
    private boolean adjustForWeekendsAndHolidays;
    @Column(name = "effective_from", nullable = false, length = 10)
    private LocalDate effectiveFrom;
    @Column(name = "effective_to", length = 10)
    private LocalDate effectiveTo;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public BudgetCycleRuleEntity() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public int getStartDay() { return startDay; }
    public void setStartDay(int startDay) { this.startDay = startDay; }
    public boolean isAdjustForWeekendsAndHolidays() { return adjustForWeekendsAndHolidays; }
    public void setAdjustForWeekendsAndHolidays(boolean value) { this.adjustForWeekendsAndHolidays = value; }
    public LocalDate getEffectiveFrom() { return effectiveFrom; }
    public void setEffectiveFrom(LocalDate effectiveFrom) { this.effectiveFrom = effectiveFrom; }
    public LocalDate getEffectiveTo() { return effectiveTo; }
    public void setEffectiveTo(LocalDate effectiveTo) { this.effectiveTo = effectiveTo; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
