package com.ecommerce.auth.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private static final Logger logger = LoggerFactory.getLogger(EmailService.class);
    private final JavaMailSender mailSender;

    public EmailService(ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.mailSender = mailSenderProvider.getIfAvailable();
    }

    @Async
    public void sendWelcomeEmail(String toEmail, String name) {
        String subject = "Welcome to Aura E-Commerce!";
        String text = String.format(
                "Hello %s,\n\n" +
                "Thank you for signing up with Aura E-Commerce! Your secure profile has been initialized.\n\n" +
                "You can now log in, add items to your cart, and track checkout orders using our reactive Saga dashboard.\n\n" +
                "Best regards,\n" +
                "The Aura E-Commerce Team",
                name
        );

        if (mailSender == null) {
            logger.warn("\n" +
                    "========================================================================\n" +
                    "  [MAIL MOCK] SMTP Server is not configured in environment variables.\n" +
                    "  Simulating email dispatch for registration:\n" +
                    "  TO: {}\n" +
                    "  SUBJECT: {}\n" +
                    "  BODY:\n{}\n" +
                    "========================================================================", 
                    toEmail, subject, text);
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(toEmail);
            message.setSubject(subject);
            message.setText(text);
            message.setFrom("noreply@aura-ecommerce.com");

            mailSender.send(message);
            logger.info("Successfully sent welcome email to {}", toEmail);
        } catch (Exception e) {
            logger.error("Failed to send email to {} via SMTP: {}. Falling back to simulation.", toEmail, e.getMessage());
            logger.warn("\n" +
                    "========================================================================\n" +
                    "  [MAIL MOCK - FALLBACK] Simulated welcome email to {}:\n" +
                    "  SUBJECT: {}\n" +
                    "  BODY:\n{}\n" +
                    "========================================================================", 
                    toEmail, subject, text);
        }
    }
}
