package com.ecommerce.payment.config;

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
            logger.info("Initializing payment database schema: Updating payments_status_check constraint to support PENDING...");
            jdbcTemplate.execute("ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check");
            jdbcTemplate.execute("ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (status::text = ANY (ARRAY['PENDING'::text, 'SUCCESS'::text, 'FAILED'::text]))");
            logger.info("Successfully updated payments_status_check constraint in payments table.");
        } catch (Exception e) {
            logger.warn("Could not alter payments table check constraint (it may already be altered or database schema might differ): {}", e.getMessage());
        }
    }
}
