package com.ecommerce.order.event;

import com.ecommerce.order.model.Order;
import org.springframework.cloud.stream.function.StreamBridge;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class OrderEventPublisher {

    private final StreamBridge streamBridge;

    public OrderEventPublisher(StreamBridge streamBridge) {
        this.streamBridge = streamBridge;
    }

    public void publishOrderCreatedEvent(Order order) {
        List<OrderItemEvent> items = order.getItems().stream()
                .map(item -> new OrderItemEvent(
                        item.getProductId(),
                        item.getName(),
                        item.getQuantity(),
                        item.getPrice()
                ))
                .collect(Collectors.toList());

        OrderCreatedEvent event = new OrderCreatedEvent(
                order.getId(),
                order.getUserId(),
                order.getTotalAmount(),
                items
        );

        // Send to the destination mapped in application.properties
        streamBridge.send("orderSource-out-0", event);
    }
}
