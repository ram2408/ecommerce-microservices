package com.ecommerce.inventory.service;

import com.ecommerce.inventory.event.dto.OrderItemEvent;
import com.ecommerce.inventory.model.Inventory;
import com.ecommerce.inventory.model.InventoryReservation;
import com.ecommerce.inventory.model.InventoryReservationItem;
import com.ecommerce.inventory.repository.InventoryRepository;
import com.ecommerce.inventory.repository.InventoryReservationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class InventoryService {

    private static final Logger log = LoggerFactory.getLogger(InventoryService.class);

    private final InventoryRepository inventoryRepository;
    private final InventoryReservationRepository reservationRepository;

    public InventoryService(InventoryRepository inventoryRepository, InventoryReservationRepository reservationRepository) {
        this.inventoryRepository = inventoryRepository;
        this.reservationRepository = reservationRepository;
    }

    @Transactional
    public void reserveStock(Long orderId, List<OrderItemEvent> items) {
        log.info("Processing stock reservation request for Order #{} with {} items", orderId, items.size());

        // Check if reservation already exists to ensure idempotency
        Optional<InventoryReservation> existing = reservationRepository.findByOrderId(orderId);
        if (existing.isPresent()) {
            log.warn("Stock reservation for Order #{} already exists. Skipping reservation creation.", orderId);
            return;
        }

        InventoryReservation reservation = new InventoryReservation(orderId);
        for (OrderItemEvent item : items) {
            InventoryReservationItem resItem = new InventoryReservationItem(item.productId(), item.quantity());
            reservation.addItem(resItem);

            // Side benefit: Ensure product exists in inventory table with at least 0 count if it doesn't exist yet
            Optional<Inventory> optInv = inventoryRepository.findByProductId(item.productId());
            if (optInv.isEmpty()) {
                Inventory initialInv = new Inventory(item.productId(), 100); // Seed with default 100 stock for easy testing!
                inventoryRepository.save(initialInv);
                log.info("Product '{}' not found in inventory. Seeded default stock level of 100 units.", item.productId());
            }
        }

        reservationRepository.save(reservation);
        log.info("Successfully created persistent stock reservation for Order #{}", orderId);
    }

    @Transactional
    public void commitStockDeduction(Long orderId) {
        log.info("Committing stock deduction for Order #{}", orderId);

        Optional<InventoryReservation> optRes = reservationRepository.findByOrderId(orderId);
        if (optRes.isEmpty()) {
            log.warn("No active stock reservation found for Order #{}. Stock may have already been processed.", orderId);
            return;
        }

        InventoryReservation reservation = optRes.get();
        for (InventoryReservationItem item : reservation.getItems()) {
            Inventory inventory = inventoryRepository.findByProductId(item.getProductId())
                    .orElseGet(() -> new Inventory(item.getProductId(), 0));

            int currentStock = inventory.getQuantity();
            int requestedQty = item.getQuantity();
            int newQty = Math.max(0, currentStock - requestedQty);

            inventory.setQuantity(newQty);
            inventoryRepository.save(inventory);

            log.info("Deducted stock for Product '{}': {} -> {} (Requested: {})",
                    item.getProductId(), currentStock, newQty, requestedQty);
        }

        // Clear reservation
        reservationRepository.delete(reservation);
        log.info("Inventory reservation for Order #{} successfully cleared and deleted.", orderId);
    }

    @Transactional
    public void releaseStockReservation(Long orderId) {
        log.info("Releasing stock reservation for Order #{}", orderId);

        Optional<InventoryReservation> optRes = reservationRepository.findByOrderId(orderId);
        if (optRes.isEmpty()) {
            log.warn("No active stock reservation found for Order #{}. Nothing to release.", orderId);
            return;
        }

        reservationRepository.delete(optRes.get());
        log.info("Inventory reservation for Order #{} has been successfully discarded (stock left intact).", orderId);
    }

    @Transactional
    public Inventory setStock(String productId, Integer quantity) {
        log.info("Updating stock level for Product '{}' to {} units", productId, quantity);
        Inventory inventory = inventoryRepository.findByProductId(productId)
                .orElseGet(() -> new Inventory(productId, 0));
        inventory.setQuantity(quantity);
        return inventoryRepository.save(inventory);
    }

    public Integer getStockLevel(String productId) {
        return inventoryRepository.findByProductId(productId)
                .map(Inventory::getQuantity)
                .orElse(0);
    }
}
