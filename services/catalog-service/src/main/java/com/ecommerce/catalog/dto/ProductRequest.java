package com.ecommerce.catalog.dto;

import java.math.BigDecimal;

public record ProductRequest(
        String name,
        String description,
        BigDecimal price,
        String imageUrl,
        String category,
        Integer stock
) {}
