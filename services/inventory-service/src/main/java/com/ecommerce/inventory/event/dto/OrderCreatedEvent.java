package com.ecommerce.inventory.event.dto;

import java.math.BigDecimal;
import java.util.List;

public record OrderCreatedEvent(
        Long orderId,
        String userId,
        BigDecimal totalAmount,
        List<OrderItemEvent> items
) {}
