package jp.zubora.kakeibo.dao;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jp.zubora.kakeibo.entity.ExpenseEntity;

public interface ExpenseDao extends JpaRepository<ExpenseEntity, UUID> {
    List<ExpenseEntity> findAllBySpentOnOrderByCreatedAtAsc(LocalDate spentOn);

    boolean existsByBudgetPeriodIdAndSpentOnAfter(UUID budgetPeriodId, LocalDate date);

    boolean existsByBudgetPeriodId(UUID budgetPeriodId);

    @Query("select coalesce(sum(e.amount), 0) from ExpenseEntity e where e.spentOn = :date")
    long sumAmountBySpentOn(@Param("date") LocalDate date);

    @Query("select e.spentOn as spentOn, sum(e.amount) as totalAmount from ExpenseEntity e where e.spentOn between :from and :to group by e.spentOn order by e.spentOn")
    List<DailyExpenseTotalProjection> sumAmountByDateRange(@Param("from") LocalDate from, @Param("to") LocalDate to);

    Optional<ExpenseEntity> findById(UUID id);
}
