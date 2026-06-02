package com.ecommerce.payment.config;

import com.razorpay.RazorpayClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RazorpayConfig {

    private static final Logger log = LoggerFactory.getLogger(RazorpayConfig.class);

    @Value("${razorpay.key.id:}")
    private String keyId;

    @Value("${razorpay.key.secret:}")
    private String keySecret;

    @Bean
    public RazorpayClient razorpayClient() {
        if (keyId.trim().isEmpty() || keySecret.trim().isEmpty()) {
            log.warn("\n" +
                    "========================================================================\n" +
                    "  [RAZORPAY WARNING] key.id or key.secret is missing in environment.\n" +
                    "  Payment Service will run in Sandbox Mock fallback mode.\n" +
                    "========================================================================");
            return null;
        }
        try {
            return new RazorpayClient(keyId, keySecret);
        } catch (Exception e) {
            log.error("Failed to initialize RazorpayClient: {}", e.getMessage());
            return null;
        }
    }
}
