package jp.zubora.kakeibo.controller;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jp.zubora.kakeibo.dto.SettingsResponse;
import jp.zubora.kakeibo.dto.SetupRequest;
import jp.zubora.kakeibo.dto.SetupStatusResponse;
import jp.zubora.kakeibo.service.SetupService;

@RestController
@RequestMapping("/api/v1/setup")
public class SetupController {
    private final SetupService service;

    public SetupController(SetupService service) {
        this.service = service;
    }

    @GetMapping
    public SetupStatusResponse getStatus() {
        return new SetupStatusResponse(service.isInitialized());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SettingsResponse setup(@Valid @RequestBody SetupRequest request) {
        return ResponseMapper.settings(service.setup(request.budgetAmount()));
    }
}
