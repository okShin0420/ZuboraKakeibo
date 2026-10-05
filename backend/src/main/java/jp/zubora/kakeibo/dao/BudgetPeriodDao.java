package jp.zubora.kakeibo.dao;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jp.zubora.kakeibo.entity.BudgetPeriodEntity;
import jp.zubora.kakeibo.entity.BudgetPeriodSummaryEntity;

public interface BudgetPeriodDao extends JpaRepository<BudgetPeriodEntity, UUID> {
    @Query("select p from BudgetPeriodEntity p where p.startDate <= :date and p.endDate >= :date")
    Optional<BudgetPeriodEntity> findContainingDate(@Param("date") LocalDate date);

    Optional<BudgetPeriodEntity> findByLabelMonth(LocalDate labelMonth);

    @Query("select p from BudgetPeriodEntity p where p.startDate <= :to and p.endDate >= :from")
    List<BudgetPeriodEntity> findOverlappingDateRange(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("select s from BudgetPeriodSummaryEntity s where s.startDate <= :date and s.endDate >= :date")
    Optional<BudgetPeriodSummaryEntity> findSummaryContaining(@Param("date") LocalDate date);

    @Query("select s from BudgetPeriodSummaryEntity s where s.labelMonth >= :from and s.labelMonth <= :to order by s.labelMonth")
    List<BudgetPeriodSummaryEntity> findSummariesByLabelMonthBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query(value = "SELECT DISTINCT CAST(substr(label_month, 1, 4) AS INTEGER) FROM budget_periods ORDER BY 1", nativeQuery = true)
    List<Integer> findDistinctLabelYears();
}
