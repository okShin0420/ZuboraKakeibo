package jp.zubora.kakeibo.config;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.regex.Pattern;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
public class FlywayLegacyBaselineStrategy {
    private static final Pattern START_DAY_31_CHECK = Pattern.compile(
            "start_day\\s+BETWEEN\\s+1\\s+AND\\s+31", Pattern.CASE_INSENSITIVE);

    @Bean
    FlywayMigrationStrategy legacyAwareFlywayMigrationStrategy(DataSource dataSource) {
        return configuredFlyway -> {
            if (hasFlywayHistory(dataSource)) {
                configuredFlyway.migrate();
                return;
            }

            int legacyVersion = readUserVersion(dataSource);
            if (legacyVersion < 0 || legacyVersion > 2) {
                throw new IllegalStateException("未対応のSQLite user_versionです: " + legacyVersion);
            }

            if (legacyVersion == 1 || legacyVersion == 2) {
                assertConsolidatedSchema(dataSource);
                Flyway legacyAwareFlyway = Flyway.configure()
                        .configuration(configuredFlyway.getConfiguration())
                        .baselineOnMigrate(true)
                        .baselineVersion(MigrationVersion.fromVersion("1"))
                        .load();
                legacyAwareFlyway.migrate();
            } else {
                configuredFlyway.migrate();
            }
        };
    }

    private static int readUserVersion(DataSource dataSource) {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA user_version")) {
            return result.next() ? result.getInt(1) : 0;
        } catch (Exception exception) {
            throw new IllegalStateException("SQLiteのuser_versionを読み取れません", exception);
        }
    }

    private static boolean hasFlywayHistory(DataSource dataSource) {
        Integer count = new JdbcTemplate(dataSource).queryForObject(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'flyway_schema_history'",
                Integer.class);
        return count != null && count == 1;
    }

    private static void assertConsolidatedSchema(DataSource dataSource) {
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        for (String table : new String[] {
                "app_settings", "budget_cycle_rules", "budget_periods", "expenses",
                "holiday_calendar_coverage", "holidays"
        }) {
            assertObjectExists(jdbc, "table", table);
        }
        for (String index : new String[] {
                "budget_cycle_rules_one_open_rule", "budget_cycle_rules_effective_dates",
                "budget_periods_date_range", "expenses_period_and_date", "expenses_spent_on"
        }) {
            assertObjectExists(jdbc, "index", index);
        }
        assertObjectExists(jdbc, "view", "budget_period_summary");

        String ruleSchema = jdbc.queryForObject(
                "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'budget_cycle_rules'",
                String.class);
        if (ruleSchema == null || !START_DAY_31_CHECK.matcher(ruleSchema).find()) {
            throw new IllegalStateException("既存SQLiteの開始日制約が1〜31日ではありません");
        }
        if (!jdbc.queryForList("PRAGMA foreign_key_check").isEmpty()) {
            throw new IllegalStateException("既存SQLiteに外部キー違反があります");
        }
    }

    private static void assertObjectExists(JdbcTemplate jdbc, String type, String name) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = ? AND name = ?",
                Integer.class, type, name);
        if (count == null || count != 1) {
            throw new IllegalStateException("既存SQLiteのスキーマ要素がありません: " + name);
        }
    }
}
