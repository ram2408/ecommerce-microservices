package com.ecommerce.cart.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.redis.core.RedisHash;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

@RedisHash("carts")
public class Cart implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    private String userId; // The primary key (email or user ID)
    private List<CartItem> items = new ArrayList<>();

    // Constructors
    public Cart() {}

    public Cart(String userId) {
        this.userId = userId;
    }

    public Cart(String userId, List<CartItem> items) {
        this.userId = userId;
        this.items = items;
    }

    // Getters and Setters
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public List<CartItem> getItems() { return items; }
    public void setItems(List<CartItem> items) { this.items = items; }
}
