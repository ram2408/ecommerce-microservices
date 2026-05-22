package com.ecommerce.payment.event.dto;

import java.math.BigDecimal;

public record PaymentCompletedEvent(
        Long orderId,
        String userId,
        String transactionReference,
        BigDecimal amount
) {}
