package com.ecommerce.cart.dto;

import java.math.BigDecimal;

public record CartItemRequest(
        String productId,
        String name,
        Integer quantity,
        BigDecimal price
) {}
