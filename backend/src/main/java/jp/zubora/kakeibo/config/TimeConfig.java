package jp.zubora.kakeibo.config;

import java.time.Clock;
import java.time.ZoneId;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class TimeConfig {
    @Bean
    Clock appClock() {
        return Clock.system(ZoneId.of("Asia/Tokyo"));
    }
}
