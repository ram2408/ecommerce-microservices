package com.ecommerce.payment.dto;

public record PaymentVerifyRequest(
        Long orderId,
        String razorpayOrderId,
        String razorpayPaymentId,
        String razorpaySignature
) {}
