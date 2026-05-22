package com.ecommerce.payment.service;

import com.ecommerce.payment.event.dto.OrderCreatedEvent;
import com.ecommerce.payment.event.dto.PaymentCompletedEvent;
import com.ecommerce.payment.event.dto.PaymentFailedEvent;
import com.ecommerce.payment.model.PaymentStatus;
import com.ecommerce.payment.model.PaymentTransaction;
import com.ecommerce.payment.repository.PaymentTransactionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.stream.function.StreamBridge;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);
    private static final BigDecimal TRANSACTION_LIMIT = new BigDecimal("5000.00");

    private final PaymentTransactionRepository paymentTransactionRepository;
    private final StreamBridge streamBridge;

    public PaymentService(PaymentTransactionRepository paymentTransactionRepository, StreamBridge streamBridge) {
        this.paymentTransactionRepository = paymentTransactionRepository;
        this.streamBridge = streamBridge;
    }

    @Transactional
    public PaymentTransaction processPayment(OrderCreatedEvent event) {
        log.info("Processing asynchronous payment for Order #{} submitted by User '{}' totaling ${}",
                event.orderId(), event.userId(), event.totalAmount());

        PaymentTransaction transaction = new PaymentTransaction();
        transaction.setOrderId(event.orderId());
        transaction.setUserId(event.userId());
        transaction.setAmount(event.totalAmount());
        transaction.setTimestamp(LocalDateTime.now());

        // Simulation business rule: orders > $5000 fail due to credit limits
        if (event.totalAmount().compareTo(TRANSACTION_LIMIT) > 0) {
            log.warn("Payment FAILED for Order #{}: Total amount ${} exceeds maximum credit limit of ${}",
                    event.orderId(), event.totalAmount(), TRANSACTION_LIMIT);

            transaction.setStatus(PaymentStatus.FAILED);
            transaction.setTransactionReference("DECLINED-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
            PaymentTransaction savedTransaction = paymentTransactionRepository.save(transaction);

            // Publish PaymentFailedEvent to the broker (Saga Rollback trigger)
            PaymentFailedEvent failEvent = new PaymentFailedEvent(
                    event.orderId(),
                    event.userId(),
                    event.totalAmount(),
                    "Credit limit exceeded. Maximum single transaction limit is $" + TRANSACTION_LIMIT
            );
            streamBridge.send("paymentSource-out-0", failEvent);
            log.info("Published PaymentFailedEvent back to RabbitMQ for Order #{}", event.orderId());

            return savedTransaction;
        } else {
            log.info("Payment SUCCESSFUL for Order #{}: Charged ${} successfully", event.orderId(), event.totalAmount());

            transaction.setStatus(PaymentStatus.SUCCESS);
            transaction.setTransactionReference("REF-" + UUID.randomUUID().toString().substring(0, 18).toUpperCase());
            PaymentTransaction savedTransaction = paymentTransactionRepository.save(transaction);

            // Publish PaymentCompletedEvent to the broker (Saga Success trigger)
            PaymentCompletedEvent successEvent = new PaymentCompletedEvent(
                    event.orderId(),
                    event.userId(),
                    savedTransaction.getTransactionReference(),
                    event.totalAmount()
            );
            streamBridge.send("paymentSource-out-0", successEvent);
            log.info("Published PaymentCompletedEvent back to RabbitMQ for Order #{}", event.orderId());

            return savedTransaction;
        }
    }

    public List<PaymentTransaction> getTransactionsByUserId(String userId) {
        return paymentTransactionRepository.findByUserId(userId);
    }

    public List<PaymentTransaction> getTransactionsByOrderId(Long orderId) {
        return paymentTransactionRepository.findByOrderId(orderId);
    }
}
