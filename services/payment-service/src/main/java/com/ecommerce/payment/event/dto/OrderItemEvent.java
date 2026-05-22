package com.ecommerce.payment.event.dto;

import java.math.BigDecimal;

public record OrderItemEvent(
        String productId,
        String name,
        Integer quantity,
        BigDecimal price
) {}
