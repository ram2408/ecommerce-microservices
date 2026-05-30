package com.ecommerce.inventory.event;

import com.ecommerce.inventory.event.dto.PaymentEvent;
import com.ecommerce.inventory.service.InventoryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.function.Consumer;

@Configuration("inventoryPaymentEventsConsumerConfig")
public class PaymentEventsConsumer {

    private static final Logger log = LoggerFactory.getLogger(PaymentEventsConsumer.class);
    private final InventoryService inventoryService;

    public PaymentEventsConsumer(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    @Bean
    public Consumer<PaymentEvent> paymentEventsConsumer() {
        return event -> {
            log.info("Received PaymentEvent for Order #{}. Status Success: {}", event.orderId(), event.isSuccess());
            try {
                if (event.isSuccess()) {
                    log.info("Payment SUCCESSFUL for Order #{}. Committing inventory deduction...", event.orderId());
                    inventoryService.commitStockDeduction(event.orderId());
                } else {
                    log.warn("Payment FAILED for Order #{}. Reason: {}. Releasing inventory reservation...",
                            event.orderId(), event.reason());
                    inventoryService.releaseStockReservation(event.orderId());
                }
            } catch (Exception e) {
                log.error("Failed to process payment event outcome for Order #{}", event.orderId(), e);
            }
        };
    }
}
