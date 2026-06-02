package com.ecommerce.payment.repository;

import com.ecommerce.payment.model.PaymentTransaction;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PaymentTransactionRepository extends CrudRepository<PaymentTransaction, Long> {
    List<PaymentTransaction> findByUserId(String userId);
    List<PaymentTransaction> findByOrderId(Long orderId);
    java.util.Optional<PaymentTransaction> findByRazorpayOrderId(String razorpayOrderId);
}
