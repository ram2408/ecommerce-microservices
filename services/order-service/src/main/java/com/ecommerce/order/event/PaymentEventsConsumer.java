package com.ecommerce.order.event;

import com.ecommerce.order.event.dto.PaymentEvent;
import com.ecommerce.order.model.OrderStatus;
import com.ecommerce.order.service.OrderService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.function.Consumer;

@Configuration("orderPaymentEventsConsumerConfig")
public class PaymentEventsConsumer {

    private static final Logger log = LoggerFactory.getLogger(PaymentEventsConsumer.class);
    private final OrderService orderService;

    public PaymentEventsConsumer(OrderService orderService) {
        this.orderService = orderService;
    }

    @Bean
    public Consumer<PaymentEvent> paymentEventsConsumer() {
        return event -> {
            log.info("Received PaymentEvent for Order #{}. Status Success: {}", event.orderId(), event.isSuccess());
            int maxRetries = 5;
            int retryDelayMs = 200;
            for (int i = 0; i < maxRetries; i++) {
                try {
                    if (event.isSuccess()) {
                        log.info("Payment completed successfully for Order #{} Ref: {}. Updating status to PAID.",
                                event.orderId(), event.transactionReference());
                        orderService.updateOrderStatus(event.orderId(), OrderStatus.PAID);
                    } else {
                        log.warn("Payment failed for Order #{}. Reason: {}. Updating status to CANCELLED.",
                                event.orderId(), event.reason());
                        orderService.updateOrderStatus(event.orderId(), OrderStatus.CANCELLED);
                    }
                    break;
                } catch (RuntimeException e) {
                    if (e.getMessage() != null && e.getMessage().contains("Order not found") && i < maxRetries - 1) {
                        log.warn("Order #{} not found in DB yet (attempt {}/{}). Retrying in {}ms...",
                                event.orderId(), i + 1, maxRetries, retryDelayMs);
                        try {
                            Thread.sleep(retryDelayMs);
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                            log.error("Retry sleep interrupted", ie);
                            break;
                        }
                    } else {
                        log.error("Failed to process payment event callback for Order #{}", event.orderId(), e);
                        break;
                    }
                } catch (Exception e) {
                    log.error("Unexpected error in payment event consumer for Order #{}", event.orderId(), e);
                    break;
                }
            }
        };
    }
}
