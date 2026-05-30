package com.ecommerce.inventory.model;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "inventory_reservations", indexes = {
    @Index(name = "idx_reservations_order_id", columnList = "orderId", unique = true)
})
public class InventoryReservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private Long orderId;

    @Column(nullable = false)
    private java.time.LocalDateTime createdAt;

    @OneToMany(mappedBy = "reservation", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<InventoryReservationItem> items = new ArrayList<>();

    // Constructors
    public InventoryReservation() {
        this.createdAt = java.time.LocalDateTime.now();
    }

    public InventoryReservation(Long orderId) {
        this.orderId = orderId;
        this.createdAt = java.time.LocalDateTime.now();
    }

    // Helper to add item
    public void addItem(InventoryReservationItem item) {
        items.add(item);
        item.setReservation(this);
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getOrderId() {
        return orderId;
    }

    public void setOrderId(Long orderId) {
        this.orderId = orderId;
    }

    public List<InventoryReservationItem> getItems() {
        return items;
    }

    public void setItems(List<InventoryReservationItem> items) {
        this.items = items;
    }

    public java.time.LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(java.time.LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
