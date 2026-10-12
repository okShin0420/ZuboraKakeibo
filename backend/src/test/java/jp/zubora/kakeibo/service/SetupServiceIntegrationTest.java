package jp.zubora.kakeibo.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.transaction.annotation.Transactional;

import jp.zubora.kakeibo.dao.AppSettingsDao;
import jp.zubora.kakeibo.dao.BudgetCycleRuleDao;
import jp.zubora.kakeibo.dao.BudgetPeriodDao;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:sqlite::memory:",
        "spring.datasource.hikari.maximum-pool-size=1",
        "spring.jpa.hibernate.ddl-auto=none",
        "logging.level.root=ERROR"
})
@Import(SetupServiceIntegrationTest.FixedClock.class)
@Transactional
class SetupServiceIntegrationTest {
    @TestConfiguration
    static class FixedClock {
        @Bean
        @Primary
        Clock fixedClock() {
            return Clock.fixed(Instant.parse("2026-09-21T03:00:00Z"), ZoneId.of("Asia/Tokyo"));
        }
    }

    @Autowired private SetupService setupService;
    @Autowired private HomeService homeService;
    @Autowired private AppSettingsDao settingsDao;
    @Autowired private BudgetCycleRuleDao ruleDao;
    @Autowired private BudgetPeriodDao periodDao;

    @Test
    void firstSetupCreatesUsableCurrentPeriodAndCannotBeRepeated() {
        assertFalse(setupService.isInitialized());
        var settings = setupService.setup(50_000);
        assertTrue(setupService.isInitialized());
        assertEquals(1, settings.startDay());
        assertFalse(settings.adjustForWeekendsAndHolidays());
        assertEquals(LocalDate.of(2026, 9, 1), settings.currentPeriodRange().startDate());
        assertEquals(50_000, homeService.getHome(LocalDate.of(2026, 9, 21)).remainingAmount());
        assertEquals(1, settingsDao.count());
        assertEquals(1, ruleDao.count());
        assertEquals(1, periodDao.count());
        assertThrows(PeriodConflictException.class, () -> setupService.setup(60_000));
    }
}
