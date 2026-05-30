package com.ecommerce.payment.event;

import com.ecommerce.payment.event.dto.OrderCreatedEvent;
import com.ecommerce.payment.service.PaymentService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.function.Consumer;

@Configuration("paymentOrderCreatedConsumerConfig")
public class OrderCreatedConsumer {

    private static final Logger log = LoggerFactory.getLogger(OrderCreatedConsumer.class);
    private final PaymentService paymentService;

    public OrderCreatedConsumer(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @Bean
    public Consumer<OrderCreatedEvent> orderConsumer() {
        return event -> {
            log.info("Received OrderCreatedEvent from RabbitMQ stream for Order #{}", event.orderId());
            try {
                paymentService.processPayment(event);
            } catch (Exception e) {
                log.error("Error occurred while executing payment processing for Order #{}", event.orderId(), e);
            }
        };
    }
}
