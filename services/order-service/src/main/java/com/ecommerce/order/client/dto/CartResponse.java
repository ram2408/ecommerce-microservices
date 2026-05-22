package com.ecommerce.order.client.dto;

import java.util.List;

public record CartResponse(
        String userId,
        List<CartItemResponse> items
) {}
