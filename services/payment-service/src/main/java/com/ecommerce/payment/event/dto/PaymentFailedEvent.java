package com.ecommerce.payment.event.dto;

import java.math.BigDecimal;

public record PaymentFailedEvent(
        Long orderId,
        String userId,
        BigDecimal amount,
        String reason
) {}
