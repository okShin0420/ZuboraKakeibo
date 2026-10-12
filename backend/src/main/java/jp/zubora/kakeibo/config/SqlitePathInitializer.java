package jp.zubora.kakeibo.config;

import java.nio.file.Files;
import java.nio.file.Path;

import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.ConfigurableEnvironment;

public class SqlitePathInitializer implements ApplicationContextInitializer<ConfigurableApplicationContext> {
    @Override
    public void initialize(ConfigurableApplicationContext applicationContext) {
        ConfigurableEnvironment environment = applicationContext.getEnvironment();
        String configuredPath = environment.getProperty("SQLITE_PATH", "./data/zubora-kakeibo.sqlite");
        Path databasePath = Path.of(configuredPath).toAbsolutePath().normalize();
        try {
            Files.createDirectories(databasePath.getParent());
        } catch (Exception exception) {
            throw new IllegalStateException("SQLiteファイルの保存先を作成できません: " + databasePath, exception);
        }
    }
}
