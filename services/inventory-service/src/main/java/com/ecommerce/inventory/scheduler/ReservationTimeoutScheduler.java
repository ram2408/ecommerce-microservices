package com.ecommerce.inventory.scheduler;

import com.ecommerce.inventory.model.InventoryReservation;
import com.ecommerce.inventory.repository.InventoryReservationRepository;
import com.ecommerce.inventory.service.InventoryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Component
public class ReservationTimeoutScheduler {

    private static final Logger log = LoggerFactory.getLogger(ReservationTimeoutScheduler.class);
    private static final int TIMEOUT_MINUTES = 5;

    private final InventoryReservationRepository reservationRepository;
    private final InventoryService inventoryService;

    public ReservationTimeoutScheduler(InventoryReservationRepository reservationRepository, InventoryService inventoryService) {
        this.reservationRepository = reservationRepository;
        this.inventoryService = inventoryService;
    }

    /**
     * Periodically checks for expired stock reservations (older than 5 minutes)
     * and releases them to prevent inventory from hanging in a reserved state indefinitely.
     */
    @Scheduled(fixedRate = 60000) // Run every 60 seconds
    public void sweepExpiredReservations() {
        LocalDateTime expirationThreshold = LocalDateTime.now().minusMinutes(TIMEOUT_MINUTES);
        log.debug("Running expired stock reservations sweep. Threshold: {}", expirationThreshold);

        List<InventoryReservation> expiredReservations = reservationRepository.findByCreatedAtBefore(expirationThreshold);

        if (!expiredReservations.isEmpty()) {
            log.info("Found {} expired stock reservations older than {} minutes. Triggering automatic releases...",
                    expiredReservations.size(), TIMEOUT_MINUTES);

            for (InventoryReservation reservation : expiredReservations) {
                try {
                    log.warn("Reservation for Order #{} has timed out (created at {}). Releasing held stock...",
                            reservation.getOrderId(), reservation.getCreatedAt());
                    inventoryService.releaseStockReservation(reservation.getOrderId());
                } catch (Exception e) {
                    log.error("Failed to release expired reservation for Order #{}", reservation.getOrderId(), e);
                }
            }
        }
    }
}
