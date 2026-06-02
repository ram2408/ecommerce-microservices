package com.ecommerce.order.config;

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
            logger.info("Initializing order database schema: Updating orders_status_check constraint to support PENDING_PAYMENT...");
            jdbcTemplate.execute("ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check");
            jdbcTemplate.execute("ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status::text = ANY (ARRAY['PENDING'::text, 'PENDING_PAYMENT'::text, 'PAID'::text, 'SHIPPED'::text, 'CANCELLED'::text, 'COMPLETED'::text]))");
            logger.info("Successfully updated orders_status_check constraint in orders table.");
        } catch (Exception e) {
            logger.warn("Could not alter orders table check constraint (it may already be altered or database schema might differ): {}", e.getMessage());
        }
    }
}
