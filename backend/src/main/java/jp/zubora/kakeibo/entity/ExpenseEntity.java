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
@Table(name = "expenses")
public class ExpenseEntity {
    @Id
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private UUID id;
    @Column(name = "budget_period_id", nullable = false, length = 36)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private UUID budgetPeriodId;
    @Column(name = "spent_on", nullable = false, length = 10)
    private LocalDate spentOn;
    @Column(nullable = false)
    private long amount;
    @Column(length = 120)
    private String memo;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public ExpenseEntity() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getBudgetPeriodId() { return budgetPeriodId; }
    public void setBudgetPeriodId(UUID budgetPeriodId) { this.budgetPeriodId = budgetPeriodId; }
    public LocalDate getSpentOn() { return spentOn; }
    public void setSpentOn(LocalDate spentOn) { this.spentOn = spentOn; }
    public long getAmount() { return amount; }
    public void setAmount(long amount) { this.amount = amount; }
    public String getMemo() { return memo; }
    public void setMemo(String memo) { this.memo = memo; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
