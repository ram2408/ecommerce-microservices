package com.ecommerce.inventory.event.dto;

import java.math.BigDecimal;

public record PaymentEvent(
        Long orderId,
        String userId,
        String transactionReference,
        BigDecimal amount,
        String reason
) {
    public boolean isSuccess() {
        return transactionReference != null && !transactionReference.trim().isEmpty();
    }
}
