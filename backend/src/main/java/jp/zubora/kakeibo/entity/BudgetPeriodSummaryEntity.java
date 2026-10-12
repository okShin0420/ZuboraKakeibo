package jp.zubora.kakeibo.entity;

import java.time.LocalDate;
import java.util.UUID;

import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Immutable
@Table(name = "budget_period_summary")
public class BudgetPeriodSummaryEntity {
    @Id
    @Column(name = "budget_period_id")
    @JdbcTypeCode(SqlTypes.VARCHAR)
    private UUID budgetPeriodId;
    @Column(name = "label_month")
    private LocalDate labelMonth;
    @Column(name = "start_date")
    private LocalDate startDate;
    @Column(name = "end_date")
    private LocalDate endDate;
    @Column(name = "budget_amount")
    private long budgetAmount;
    @Column(name = "spent_amount")
    private long spentAmount;
    @Column(name = "remaining_amount")
    private long remainingAmount;
    @Column(name = "expense_count")
    private long expenseCount;

    protected BudgetPeriodSummaryEntity() {}

    public UUID getBudgetPeriodId() { return budgetPeriodId; }
    public LocalDate getLabelMonth() { return labelMonth; }
    public LocalDate getStartDate() { return startDate; }
    public LocalDate getEndDate() { return endDate; }
    public long getBudgetAmount() { return budgetAmount; }
    public long getSpentAmount() { return spentAmount; }
    public long getRemainingAmount() { return remainingAmount; }
    public long getExpenseCount() { return expenseCount; }
}
