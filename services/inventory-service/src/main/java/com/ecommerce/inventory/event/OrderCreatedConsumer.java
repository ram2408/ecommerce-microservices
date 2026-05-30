package com.ecommerce.inventory.event;

import com.ecommerce.inventory.event.dto.OrderCreatedEvent;
import com.ecommerce.inventory.service.InventoryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.function.Consumer;

@Configuration("inventoryOrderCreatedConsumerConfig")
public class OrderCreatedConsumer {

    private static final Logger log = LoggerFactory.getLogger(OrderCreatedConsumer.class);
    private final InventoryService inventoryService;

    public OrderCreatedConsumer(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    @Bean
    public Consumer<OrderCreatedEvent> orderCreatedConsumer() {
        return event -> {
            log.info("Received OrderCreatedEvent for Order #{}", event.orderId());
            try {
                inventoryService.reserveStock(event.orderId(), event.items());
            } catch (Exception e) {
                log.error("Failed to process stock reservation for Order #{}", event.orderId(), e);
            }
        };
    }
}
