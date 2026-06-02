package com.ecommerce.order.scheduler;

import com.ecommerce.order.model.Order;
import com.ecommerce.order.model.OrderStatus;
import com.ecommerce.order.repository.OrderRepository;
import com.ecommerce.order.service.OrderService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Component
public class OrderTimeoutScheduler {

    private static final Logger log = LoggerFactory.getLogger(OrderTimeoutScheduler.class);
    private static final int TIMEOUT_MINUTES = 5;

    private final OrderRepository orderRepository;
    private final OrderService orderService;

    public OrderTimeoutScheduler(OrderRepository orderRepository, OrderService orderService) {
        this.orderRepository = orderRepository;
        this.orderService = orderService;
    }

    /**
     * Periodically sweeps for orders stuck in the PENDING status for more than 5 minutes.
     * These represent orders where payment processing or messaging failed/timed out.
     * Expired orders are automatically transitioned to CANCELLED (Saga Rollback).
     */
    @Scheduled(fixedRate = 60000) // Run every 60 seconds
    public void sweepExpiredOrders() {
        LocalDateTime expirationThreshold = LocalDateTime.now().minusMinutes(TIMEOUT_MINUTES);
        log.debug("Running pending orders timeout sweep. Threshold: {}", expirationThreshold);

        List<Order> stuckOrders = new java.util.ArrayList<>();
        stuckOrders.addAll(orderRepository.findByStatusAndCreatedAtBefore(OrderStatus.PENDING, expirationThreshold));
        stuckOrders.addAll(orderRepository.findByStatusAndCreatedAtBefore(OrderStatus.PENDING_PAYMENT, expirationThreshold));

        if (!stuckOrders.isEmpty()) {
            log.info("Found {} PENDING/PENDING_PAYMENT orders older than {} minutes. Triggering automatic timeout cancellations...",
                    stuckOrders.size(), TIMEOUT_MINUTES);

            for (Order order : stuckOrders) {
                try {
                    log.warn("Order #{} has timed out in {} state (created at {}). Transitioning to CANCELLED.",
                            order.getId(), order.getStatus(), order.getCreatedAt());
                    orderService.updateOrderStatus(order.getId(), OrderStatus.CANCELLED);
                } catch (Exception e) {
                    log.error("Failed to transition timed-out Order #{} to CANCELLED status", order.getId(), e);
                }
            }
        }
    }
}
