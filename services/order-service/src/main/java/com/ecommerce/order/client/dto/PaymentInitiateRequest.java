package com.ecommerce.order.client.dto;

import java.math.BigDecimal;

public record PaymentInitiateRequest(Long orderId, String userId, BigDecimal amount) {}
