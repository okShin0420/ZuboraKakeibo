package jp.zubora.kakeibo.controller;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jp.zubora.kakeibo.dto.HomeResponse;
import jp.zubora.kakeibo.dto.result.HomeResult;
import jp.zubora.kakeibo.service.HomeService;

@RestController
@RequestMapping("/api/v1/home")
public class HomeController {
    private final HomeService service;

    public HomeController(HomeService service) {
        this.service = service;
    }

    @GetMapping
    public HomeResponse getHome(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOf) {
        HomeResult result = service.getHome(asOf);
        return new HomeResponse(result.labelMonth(), result.budgetAmount(), result.spentAmount(),
                result.remainingAmount(), result.todayExpense(), result.remainingDays(), result.message());
    }
}
