package jp.zubora.kakeibo.controller;

import java.time.Clock;
import java.time.LocalDate;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jp.zubora.kakeibo.dto.SettingsResponse;
import jp.zubora.kakeibo.dto.UpdateSettingsRequest;
import jp.zubora.kakeibo.dto.command.UpdateSettingsCommand;
import jp.zubora.kakeibo.service.SettingsService;

@RestController
@RequestMapping("/api/v1/settings")
public class SettingsController {
    private final SettingsService service;
    private final Clock clock;

    public SettingsController(SettingsService service, Clock clock) {
        this.service = service;
        this.clock = clock;
    }

    @GetMapping
    public SettingsResponse getSettings() {
        return ResponseMapper.settings(service.getSettings(LocalDate.now(clock)));
    }

    @PutMapping
    public SettingsResponse updateSettings(@Valid @RequestBody UpdateSettingsRequest request) {
        return ResponseMapper.settings(service.updateSettings(new UpdateSettingsCommand(
                request.monthlyNotificationEnabled(), request.startDay(),
                request.adjustForWeekendsAndHolidays())));
    }
}
