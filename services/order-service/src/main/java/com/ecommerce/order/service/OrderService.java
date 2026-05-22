package com.ecommerce.order.service;

import com.ecommerce.order.client.CartClient;
import com.ecommerce.order.client.dto.CartItemResponse;
import com.ecommerce.order.client.dto.CartResponse;
import com.ecommerce.order.model.Order;
import com.ecommerce.order.model.OrderItem;
import com.ecommerce.order.model.OrderStatus;
import com.ecommerce.order.repository.OrderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final CartClient cartClient;

    public OrderService(OrderRepository orderRepository, CartClient cartClient) {
        this.orderRepository = orderRepository;
        this.cartClient = cartClient;
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

        // 5. Clear the shopping cart asynchronously (conceptually) or synchronously via Feign
        cartClient.clearCart(userId);

        return savedOrder;
    }

    public Optional<Order> getOrderById(Long orderId) {
        return orderRepository.findById(orderId);
    }

    public List<Order> getOrdersByUserId(String userId) {
        return orderRepository.findByUserId(userId);
    }
}
