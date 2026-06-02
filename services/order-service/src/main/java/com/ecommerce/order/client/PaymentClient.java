package com.ecommerce.order.client;

import com.ecommerce.order.client.dto.PaymentInitiateRequest;
import com.ecommerce.order.client.dto.PaymentInitiateResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "payment-service", url = "${payment.service.url:http://localhost:8085}")
public interface PaymentClient {

    @PostMapping("/api/payments/initiate")
    PaymentInitiateResponse initiatePayment(@RequestBody PaymentInitiateRequest request);
}
