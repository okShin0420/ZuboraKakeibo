package jp.zubora.kakeibo.dao;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jp.zubora.kakeibo.entity.BudgetCycleRuleEntity;

public interface BudgetCycleRuleDao extends JpaRepository<BudgetCycleRuleEntity, UUID> {
    @Query("select r from BudgetCycleRuleEntity r where r.effectiveFrom <= :date and (r.effectiveTo is null or r.effectiveTo >= :date)")
    Optional<BudgetCycleRuleEntity> findEffectiveAt(@Param("date") LocalDate date);

    @Query("select r from BudgetCycleRuleEntity r where r.effectiveFrom <= :to and (r.effectiveTo is null or r.effectiveTo >= :from)")
    List<BudgetCycleRuleEntity> findOverlapping(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
