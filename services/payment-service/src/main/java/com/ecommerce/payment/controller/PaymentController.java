package com.ecommerce.payment.controller;

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

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<PaymentTransaction>> getTransactionsByUserId(@PathVariable String userId) {
        return ResponseEntity.ok(paymentService.getTransactionsByUserId(userId));
    }

    @GetMapping("/order/{orderId}")
    public ResponseEntity<List<PaymentTransaction>> getTransactionsByOrderId(@PathVariable Long orderId) {
        return ResponseEntity.ok(paymentService.getTransactionsByOrderId(orderId));
    }
}
