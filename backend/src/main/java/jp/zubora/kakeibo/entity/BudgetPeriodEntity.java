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
@Table(name = "budget_periods")
public class BudgetPeriodEntity {
    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private UUID id;
    @Column(name = "cycle_rule_id", nullable = false, length = 36)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private UUID cycleRuleId;
    @Column(name = "label_month", nullable = false, length = 10)
    private LocalDate labelMonth;
    @Column(name = "start_date", nullable = false, length = 10)
    private LocalDate startDate;
    @Column(name = "nominal_end_date", nullable = false, length = 10)
    private LocalDate nominalEndDate;
    @Column(name = "end_date", nullable = false, length = 10)
    private LocalDate endDate;
    @Column(name = "budget_amount", nullable = false)
    private long budgetAmount;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public BudgetPeriodEntity() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getCycleRuleId() { return cycleRuleId; }
    public void setCycleRuleId(UUID cycleRuleId) { this.cycleRuleId = cycleRuleId; }
    public LocalDate getLabelMonth() { return labelMonth; }
    public void setLabelMonth(LocalDate labelMonth) { this.labelMonth = labelMonth; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getNominalEndDate() { return nominalEndDate; }
    public void setNominalEndDate(LocalDate nominalEndDate) { this.nominalEndDate = nominalEndDate; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    public long getBudgetAmount() { return budgetAmount; }
    public void setBudgetAmount(long budgetAmount) { this.budgetAmount = budgetAmount; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
