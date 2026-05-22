package com.ecommerce.order.event;

import java.math.BigDecimal;

public record OrderItemEvent(
        String productId,
        String name,
        Integer quantity,
        BigDecimal price
) {}
