package com.ecommerce.inventory.repository;

import com.ecommerce.inventory.model.InventoryAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InventoryAuditLogRepository extends JpaRepository<InventoryAuditLog, Long> {
    List<InventoryAuditLog> findAllByOrderByTimestampDesc();
    List<InventoryAuditLog> findByVendorIdOrderByTimestampDesc(String vendorId);
}
