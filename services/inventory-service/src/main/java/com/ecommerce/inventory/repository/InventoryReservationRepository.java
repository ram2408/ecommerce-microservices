package com.ecommerce.inventory.repository;

import com.ecommerce.inventory.model.InventoryReservation;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface InventoryReservationRepository extends CrudRepository<InventoryReservation, Long> {
    Optional<InventoryReservation> findByOrderId(Long orderId);
    List<InventoryReservation> findByCreatedAtBefore(LocalDateTime timestamp);
}
