package com.ecommerce.order.client.dto;

import java.math.BigDecimal;

public record PaymentInitiateResponse(
        String razorpayOrderId,
        BigDecimal amount,
        String currency,
        String keyId,
        boolean mockMode
) {}
