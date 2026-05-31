package com.ecommerce.auth.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
public class DatabaseConfig implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(DatabaseConfig.class);
    private final JdbcTemplate jdbcTemplate;

    public DatabaseConfig(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) throws Exception {
        try {
            logger.info("Initializing database schema: Dropping NOT NULL constraint on users.password...");
            jdbcTemplate.execute("ALTER TABLE users ALTER COLUMN password DROP NOT NULL");
            logger.info("Successfully altered users table password column to be nullable.");
        } catch (Exception e) {
            logger.warn("Could not alter users table (it may already be nullable or altered): {}", e.getMessage());
        }
    }
}
