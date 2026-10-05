package jp.zubora.kakeibo.controller;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jp.zubora.kakeibo.dto.CreateExpenseRequest;
import jp.zubora.kakeibo.dto.ExpenseResponse;
import jp.zubora.kakeibo.dto.UpdateExpenseRequest;
import jp.zubora.kakeibo.dto.command.CreateExpenseCommand;
import jp.zubora.kakeibo.dto.command.UpdateExpenseCommand;
import jp.zubora.kakeibo.service.ExpenseService;

@RestController
@RequestMapping("/api/v1/expenses")
public class ExpenseController {
    private final ExpenseService service;

    public ExpenseController(ExpenseService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ExpenseResponse createExpense(@Valid @RequestBody CreateExpenseRequest request) {
        return ResponseMapper.expense(service.createExpense(
                new CreateExpenseCommand(request.spentOn(), request.amount(), request.memo())));
    }

    @PutMapping("/{expenseId}")
    public ExpenseResponse updateExpense(@PathVariable UUID expenseId,
                                         @Valid @RequestBody UpdateExpenseRequest request) {
        return ResponseMapper.expense(service.updateExpense(expenseId,
                new UpdateExpenseCommand(request.spentOn(), request.amount(), request.memo())));
    }
}
