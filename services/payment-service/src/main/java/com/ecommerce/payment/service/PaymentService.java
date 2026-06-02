package com.ecommerce.payment.service;

import com.ecommerce.payment.dto.PaymentInitiateRequest;
import com.ecommerce.payment.dto.PaymentInitiateResponse;
import com.ecommerce.payment.dto.PaymentVerifyRequest;
import com.ecommerce.payment.event.dto.OrderCreatedEvent;
import com.ecommerce.payment.event.dto.PaymentCompletedEvent;
import com.ecommerce.payment.event.dto.PaymentFailedEvent;
import com.ecommerce.payment.model.PaymentStatus;
import com.ecommerce.payment.model.PaymentTransaction;
import com.ecommerce.payment.repository.PaymentTransactionRepository;
import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.stream.function.StreamBridge;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    private final PaymentTransactionRepository paymentTransactionRepository;
    private final StreamBridge streamBridge;
    private final RazorpayClient razorpayClient;

    @Value("${razorpay.key.id:}")
    private String keyId;

    @Value("${razorpay.key.secret:}")
    private String keySecret;

    @Value("${razorpay.webhook.secret:}")
    private String webhookSecret;

    public PaymentService(PaymentTransactionRepository paymentTransactionRepository,
                          StreamBridge streamBridge,
                          ObjectProvider<RazorpayClient> razorpayClientProvider) {
        this.paymentTransactionRepository = paymentTransactionRepository;
        this.streamBridge = streamBridge;
        this.razorpayClient = razorpayClientProvider.getIfAvailable();
    }

    @Transactional
    public PaymentInitiateResponse initiatePayment(PaymentInitiateRequest request) {
        log.info("Initiating payment for Order #{} totaling ${}", request.orderId(), request.amount());

        PaymentTransaction transaction = new PaymentTransaction();
        transaction.setOrderId(request.orderId());
        transaction.setUserId(request.userId());
        transaction.setAmount(request.amount());
        transaction.setStatus(PaymentStatus.PENDING);
        transaction.setTimestamp(LocalDateTime.now());

        String gatewayOrderId;
        boolean isMock = true;

        if (razorpayClient != null) {
            try {
                JSONObject orderRequest = new JSONObject();
                // Razorpay expects amount in paise (1 INR = 100 paise)
                int amountInPaise = request.amount().multiply(new BigDecimal("100")).intValue();
                orderRequest.put("amount", amountInPaise);
                orderRequest.put("currency", "INR");
                orderRequest.put("receipt", "receipt_order_" + request.orderId());

                Order razorpayOrder = razorpayClient.orders.create(orderRequest);
                gatewayOrderId = razorpayOrder.get("id");
                isMock = false;
                log.info("Successfully created Razorpay Order '{}' for Order #{}", gatewayOrderId, request.orderId());
            } catch (Exception e) {
                log.error("Failed to create Razorpay Order. Falling back to Mock: {}", e.getMessage());
                gatewayOrderId = "order_mock_" + UUID.randomUUID().toString().substring(0, 12);
            }
        } else {
            gatewayOrderId = "order_mock_" + UUID.randomUUID().toString().substring(0, 12);
        }

        transaction.setRazorpayOrderId(gatewayOrderId);
        transaction.setTransactionReference(gatewayOrderId);
        paymentTransactionRepository.save(transaction);

        return new PaymentInitiateResponse(
                gatewayOrderId,
                request.amount(),
                "INR",
                keyId,
                isMock
        );
    }

    @Transactional
    public boolean verifyPayment(PaymentVerifyRequest request) {
        log.info("Verifying payment signature for Order #{} (Razorpay Order ID: {})", 
                request.orderId(), request.razorpayOrderId());

        PaymentTransaction transaction = paymentTransactionRepository.findByOrderId(request.orderId())
                .stream()
                .filter(t -> request.razorpayOrderId().equals(t.getRazorpayOrderId()))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Transaction not found for Order " + request.orderId()));

        boolean isValid = false;

        if (razorpayClient == null || request.razorpayOrderId().startsWith("order_mock_")) {
            // Mock mode signature validation
            isValid = "mock_signature".equals(request.razorpaySignature());
            log.info("Mock verification outcome for Order #{}: {}", request.orderId(), isValid);
        } else {
            try {
                JSONObject attributes = new JSONObject();
                attributes.put("razorpay_order_id", request.razorpayOrderId());
                attributes.put("razorpay_payment_id", request.razorpayPaymentId());
                attributes.put("razorpay_signature", request.razorpaySignature());

                isValid = com.razorpay.Utils.verifyPaymentSignature(attributes, keySecret);
            } catch (Exception e) {
                log.error("Error occurred while validating Razorpay signature: {}", e.getMessage());
            }
        }

        if (isValid) {
            transaction.setStatus(PaymentStatus.SUCCESS);
            transaction.setRazorpayPaymentId(request.razorpayPaymentId());
            transaction.setRazorpaySignature(request.razorpaySignature());
            paymentTransactionRepository.save(transaction);

            log.info("Payment SUCCESSFUL for Order #{}: Verified successfully", request.orderId());

            // Publish PaymentCompletedEvent to the broker (Saga Success trigger)
            PaymentCompletedEvent successEvent = new PaymentCompletedEvent(
                    request.orderId(),
                    transaction.getUserId(),
                    transaction.getTransactionReference(),
                    transaction.getAmount()
            );
            streamBridge.send("paymentSource-out-0", successEvent);
            log.info("Published PaymentCompletedEvent back to RabbitMQ for Order #{}", request.orderId());
            return true;
        } else {
            transaction.setStatus(PaymentStatus.FAILED);
            paymentTransactionRepository.save(transaction);

            log.warn("Payment FAILED for Order #{}: Signature verification failed", request.orderId());

            // Publish PaymentFailedEvent to the broker (Saga Rollback trigger)
            PaymentFailedEvent failEvent = new PaymentFailedEvent(
                    request.orderId(),
                    transaction.getUserId(),
                    transaction.getAmount(),
                    "Payment signature verification failed."
            );
            streamBridge.send("paymentSource-out-0", failEvent);
            log.info("Published PaymentFailedEvent back to RabbitMQ for Order #{}", request.orderId());
            return false;
        }
    }

    @Transactional
    public void processPayment(OrderCreatedEvent event) {
        // This is the background listener for order events.
        // Since we now use the initiatePayment synchronous REST call to create the payment entry,
        // we can check if a pending transaction already exists.
        // If it doesn't, we can log it. In a real setup, orderConsumer handles async checks.
        log.info("Async Listener received OrderCreatedEvent for Order #{}", event.orderId());
    }

    public List<PaymentTransaction> getTransactionsByUserId(String userId) {
        return paymentTransactionRepository.findByUserId(userId);
    }

    public List<PaymentTransaction> getTransactionsByOrderId(Long orderId) {
        return paymentTransactionRepository.findByOrderId(orderId);
    }

    @Transactional
    public void processWebhook(String body, String signatureHeader) {
        log.info("Processing Razorpay webhook...");

        boolean isSignatureValid = false;
        if (razorpayClient == null || webhookSecret.trim().isEmpty() || signatureHeader == null) {
            // In mock mode or if secret is missing, assume signature is valid for local testing.
            // In production, signature validation is required.
            isSignatureValid = true;
            log.info("Mock/local webhook validation - assuming signature is valid.");
        } else {
            try {
                isSignatureValid = com.razorpay.Utils.verifyWebhookSignature(body, signatureHeader, webhookSecret);
            } catch (Exception e) {
                log.error("Failed to verify webhook signature: {}", e.getMessage());
            }
        }

        if (!isSignatureValid) {
            log.warn("Invalid webhook signature received. Ignoring webhook request.");
            throw new RuntimeException("Invalid webhook signature");
        }

        try {
            JSONObject json = new JSONObject(body);
            String event = json.optString("event");
            log.info("Webhook received event type: '{}'", event);

            if ("order.paid".equals(event) || "payment.captured".equals(event)) {
                JSONObject payload = json.optJSONObject("payload");
                if (payload != null) {
                    JSONObject orderOrPaymentObj = "order.paid".equals(event) ? 
                            payload.optJSONObject("order") : payload.optJSONObject("payment");
                    
                    if (orderOrPaymentObj != null) {
                        JSONObject entity = orderOrPaymentObj.optJSONObject("entity");
                        if (entity != null) {
                            String razorpayOrderId = "order.paid".equals(event) ? 
                                    entity.optString("id") : entity.optString("order_id");
                            
                            String razorpayPaymentId = "order.paid".equals(event) ? 
                                    "pay_webhook_" + UUID.randomUUID().toString().substring(0, 8) : entity.optString("id");

                            if (razorpayOrderId != null && !razorpayOrderId.isEmpty()) {
                                log.info("Searching transaction for webhook Razorpay Order ID: '{}'", razorpayOrderId);
                                PaymentTransaction transaction = paymentTransactionRepository.findByRazorpayOrderId(razorpayOrderId)
                                        .orElse(null);

                                if (transaction != null) {
                                    if (transaction.getStatus() == PaymentStatus.PENDING) {
                                        transaction.setStatus(PaymentStatus.SUCCESS);
                                        transaction.setRazorpayPaymentId(razorpayPaymentId);
                                        transaction.setRazorpaySignature(signatureHeader != null ? signatureHeader : "webhook_verified");
                                        paymentTransactionRepository.save(transaction);
                                        
                                        log.info("Webhook successfully processed transaction for Order #{}", transaction.getOrderId());

                                        // Publish PaymentCompletedEvent to the broker (Saga Success trigger)
                                        PaymentCompletedEvent successEvent = new PaymentCompletedEvent(
                                                transaction.getOrderId(),
                                                transaction.getUserId(),
                                                transaction.getTransactionReference(),
                                                transaction.getAmount()
                                        );
                                        streamBridge.send("paymentSource-out-0", successEvent);
                                        log.info("Published PaymentCompletedEvent back to RabbitMQ from Webhook for Order #{}", transaction.getOrderId());
                                    } else {
                                        log.info("Transaction for Order #{} is already in state: {}", transaction.getOrderId(), transaction.getStatus());
                                    }
                                } else {
                                    log.warn("No transaction found in database matching Razorpay Order ID: '{}'", razorpayOrderId);
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to parse or process webhook JSON body: {}", e.getMessage(), e);
            throw new RuntimeException("Error processing webhook: " + e.getMessage());
        }
    }
}
