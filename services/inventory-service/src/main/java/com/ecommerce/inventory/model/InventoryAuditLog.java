package com.ecommerce.inventory.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "inventory_audit_logs", indexes = {
    @Index(name = "idx_audit_vendor_id", columnList = "vendorId"),
    @Index(name = "idx_audit_product_id", columnList = "productId")
})
public class InventoryAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String productId;

    @Column(nullable = false)
    private String vendorId;

    @Column(nullable = true)
    private Long orderId;

    @Column(nullable = false)
    private String actionType; // RESTOCKED, RESERVED, COMMITTED, RELEASED

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @Column(nullable = true, length = 500)
    private String description;

    // Constructors
    public InventoryAuditLog() {}

    public InventoryAuditLog(String productId, String vendorId, Long orderId, String actionType, Integer quantity, String description) {
        this.productId = productId;
        this.vendorId = vendorId != null ? vendorId : "SYSTEM";
        this.orderId = orderId;
        this.actionType = actionType;
        this.quantity = quantity;
        this.timestamp = LocalDateTime.now();
        this.description = description;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getProductId() {
        return productId;
    }

    public void setProductId(String productId) {
        this.productId = productId;
    }

    public String getVendorId() {
        return vendorId;
    }

    public void setVendorId(String vendorId) {
        this.vendorId = vendorId;
    }

    public Long getOrderId() {
        return orderId;
    }

    public void setOrderId(Long orderId) {
        this.orderId = orderId;
    }

    public String getActionType() {
        return actionType;
    }

    public void setActionType(String actionType) {
        this.actionType = actionType;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
