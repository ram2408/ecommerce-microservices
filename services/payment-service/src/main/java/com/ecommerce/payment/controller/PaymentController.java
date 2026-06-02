package com.ecommerce.payment.controller;

import com.ecommerce.payment.dto.PaymentInitiateRequest;
import com.ecommerce.payment.dto.PaymentInitiateResponse;
import com.ecommerce.payment.dto.PaymentVerifyRequest;
import com.ecommerce.payment.model.PaymentTransaction;
import com.ecommerce.payment.service.PaymentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping("/initiate")
    public ResponseEntity<PaymentInitiateResponse> initiatePayment(@RequestBody PaymentInitiateRequest request) {
        return ResponseEntity.ok(paymentService.initiatePayment(request));
    }

    @PostMapping("/verify")
    public ResponseEntity<Boolean> verifyPayment(@RequestBody PaymentVerifyRequest request) {
        return ResponseEntity.ok(paymentService.verifyPayment(request));
    }

    @PostMapping("/webhook")
    public ResponseEntity<Void> handleWebhook(
            @RequestBody String body,
            @RequestHeader(value = "X-Razorpay-Signature", required = false) String signatureHeader) {
        paymentService.processWebhook(body, signatureHeader);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<PaymentTransaction>> getTransactionsByUserId(@PathVariable String userId) {
        return ResponseEntity.ok(paymentService.getTransactionsByUserId(userId));
    }

    @GetMapping("/order/{orderId}")
    public ResponseEntity<List<PaymentTransaction>> getTransactionsByOrderId(@PathVariable Long orderId) {
        return ResponseEntity.ok(paymentService.getTransactionsByOrderId(orderId));
    }
}
