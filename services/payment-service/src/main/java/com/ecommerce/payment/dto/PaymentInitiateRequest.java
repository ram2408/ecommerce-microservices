package com.ecommerce.payment.dto;

import java.math.BigDecimal;

public record PaymentInitiateRequest(Long orderId, String userId, BigDecimal amount) {}
