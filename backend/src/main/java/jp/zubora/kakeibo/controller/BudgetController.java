package jp.zubora.kakeibo.controller;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jp.zubora.kakeibo.dto.BudgetResponse;
import jp.zubora.kakeibo.dto.UpdateBudgetRequest;
import jp.zubora.kakeibo.service.BudgetService;

@RestController
@RequestMapping("/api/v1/budgets/current")
public class BudgetController {
    private final BudgetService service;

    public BudgetController(BudgetService service) {
        this.service = service;
    }

    @GetMapping
    public BudgetResponse getCurrentBudget(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOf) {
        return ResponseMapper.budget(service.getCurrentBudget(asOf));
    }

    @PutMapping
    public BudgetResponse updateCurrentBudget(@Valid @RequestBody UpdateBudgetRequest request) {
        return ResponseMapper.budget(service.updateCurrentBudget(request.asOf(), request.amount()));
    }
}
