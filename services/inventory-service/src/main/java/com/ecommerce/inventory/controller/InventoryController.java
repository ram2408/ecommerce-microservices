package com.ecommerce.inventory.controller;

import com.ecommerce.inventory.model.Inventory;
import com.ecommerce.inventory.service.InventoryService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    public record StockResponse(String productId, Integer stockQuantity) {}
    public record UpdateStockRequest(String productId, Integer quantity) {}

    @GetMapping("/{productId}")
    public ResponseEntity<StockResponse> getStockLevel(@PathVariable String productId) {
        Integer quantity = inventoryService.getStockLevel(productId);
        return ResponseEntity.ok(new StockResponse(productId, quantity));
    }

    @PostMapping
    public ResponseEntity<Inventory> setStockLevel(@RequestBody UpdateStockRequest request) {
        if (request.productId() == null || request.productId().trim().isEmpty()) {
            throw new IllegalArgumentException("Product ID cannot be null or empty.");
        }
        if (request.quantity() == null || request.quantity() < 0) {
            throw new IllegalArgumentException("Quantity must be a non-negative integer.");
        }

        Inventory inventory = inventoryService.setStock(request.productId(), request.quantity());
        return ResponseEntity.ok(inventory);
    }
}
