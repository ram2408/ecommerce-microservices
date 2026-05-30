package com.ecommerce.order.service;

import com.ecommerce.order.client.CartClient;
import com.ecommerce.order.client.dto.CartItemResponse;
import com.ecommerce.order.client.dto.CartResponse;
import com.ecommerce.order.event.OrderEventPublisher;
import com.ecommerce.order.model.Order;
import com.ecommerce.order.model.OrderItem;
import com.ecommerce.order.model.OrderStatus;
import com.ecommerce.order.repository.OrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class OrderService {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);

    private final OrderRepository orderRepository;
    private final CartClient cartClient;
    private final OrderEventPublisher orderEventPublisher;

    public OrderService(OrderRepository orderRepository, CartClient cartClient, OrderEventPublisher orderEventPublisher) {
        this.orderRepository = orderRepository;
        this.cartClient = cartClient;
        this.orderEventPublisher = orderEventPublisher;
    }

    @Transactional
    public Order createOrder(String userId) {
        // 1. Fetch user's active cart from the cart-service
        CartResponse cart = cartClient.getCart(userId);
        
        if (cart == null || cart.items() == null || cart.items().isEmpty()) {
            throw new IllegalStateException("Cannot place an order with an empty shopping cart.");
        }

        // 2. Initialize the Order entity
        Order order = new Order();
        order.setUserId(userId);
        order.setStatus(OrderStatus.PENDING);
        order.setCreatedAt(LocalDateTime.now());

        BigDecimal totalAmount = BigDecimal.ZERO;

        // 3. Map Cart Items to Order Items and compute the running total
        for (CartItemResponse cartItem : cart.items()) {
            OrderItem orderItem = new OrderItem(
                    cartItem.productId(),
                    cartItem.name(),
                    cartItem.quantity(),
                    cartItem.price()
            );
            
            // Link item to order
            order.addItem(orderItem);
            
            // Calculate item subtotal and add to total amount
            BigDecimal subtotal = cartItem.price().multiply(BigDecimal.valueOf(cartItem.quantity()));
            totalAmount = totalAmount.add(subtotal);
        }

        order.setTotalAmount(totalAmount);

        // 4. Save the order and its cascade items to PostgreSQL
        Order savedOrder = orderRepository.save(order);

        // 5. Publish the Order Created Event asynchronously to RabbitMQ after database transaction commits
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    log.info("Transaction committed successfully for Order #{}. Publishing event.", savedOrder.getId());
                    orderEventPublisher.publishOrderCreatedEvent(savedOrder);
                }
            });
        } else {
            orderEventPublisher.publishOrderCreatedEvent(savedOrder);
        }

        // 6. Clear the shopping cart
        cartClient.clearCart(userId);

        return savedOrder;
    }

    public Optional<Order> getOrderById(Long orderId) {
        return orderRepository.findById(orderId);
    }

    public List<Order> getOrdersByUserId(String userId) {
        return orderRepository.findByUserId(userId);
    }

    @Transactional
    public void updateOrderStatus(Long orderId, OrderStatus status) {
        log.info("Attempting to transition Order #{} status to {}", orderId, status);
        Order order = getOrderById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found with id: " + orderId));
        order.setStatus(status);
        orderRepository.save(order);
        log.info("Order #{} status successfully updated to {}", orderId, status);
    }
}
