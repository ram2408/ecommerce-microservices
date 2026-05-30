package com.ecommerce.inventory.event.dto;

import java.math.BigDecimal;

public record OrderItemEvent(
        String productId,
        String name,
        Integer quantity,
        BigDecimal price
) {}
