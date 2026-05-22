package com.ecommerce.order.client.dto;

import java.math.BigDecimal;

public record CartItemResponse(
        String productId,
        String name,
        Integer quantity,
        BigDecimal price
) {}
