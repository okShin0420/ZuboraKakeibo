package jp.zubora.kakeibo.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jp.zubora.kakeibo.dto.YearlyBudgetSummaryResponse;
import jp.zubora.kakeibo.service.GraphService;

@RestController
@RequestMapping("/api/v1/graphs")
public class GraphController {
    private final GraphService service;

    public GraphController(GraphService service) {
        this.service = service;
    }

    @GetMapping("/yearly")
    public YearlyBudgetSummaryResponse getYearlySummary(@RequestParam int year) {
        var result = service.getYearlySummary(year);
        return new YearlyBudgetSummaryResponse(result.year(), result.availableYears(), result.monthlySummaries());
    }
}
