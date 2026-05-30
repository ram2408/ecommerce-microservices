'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { apiFetch } from '../../utils/api';
import { useRouter } from 'next/navigation';
import styles from './checkout.module.css';

export default function CheckoutPage() {
  const { user, cart, clearCart } = useApp();
  const [shippingName, setShippingName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [cardNumber, setCardNumber] = useState('4111 2222 3333 4444');
  const [expiry, setExpiry] = useState('12/28');
  const [cvv, setCvv] = useState('385');
  
  // Saga Simulator State
  const [checkoutActive, setCheckoutActive] = useState(false);
  const [sagaState, setSagaState] = useState('START'); // START, SUBMITTING, PAYMENT_PENDING, SUCCESS, FAILED
  const [sagaOrderId, setSagaOrderId] = useState(null);
  const [sagaErrorMsg, setSagaErrorMsg] = useState('');
  const [pollCount, setPollCount] = useState(0);

  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/auth');
    }
  }, [user, router]);

  if (!user || (cart.items.length === 0 && !checkoutActive)) {
    if (typeof window !== 'undefined') {
      router.push('/');
    }
    return null;
  }

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setCheckoutActive(true);
    setSagaState('SUBMITTING');
    setSagaErrorMsg('');
    setPollCount(0);

    try {
      // 1. Submit Checkout request to Order Service via Gateway
      // End point: POST /api/orders?userId={userId}
      const order = await apiFetch(`/api/orders?userId=${user.email}`, {
        method: 'POST'
      });

      if (order && order.id) {
        setSagaOrderId(order.id);
        setSagaState('PAYMENT_PENDING');
        // Start polling the backend Order Service to visualize Saga updates
        startSagaPolling(order.id);
      } else {
        throw new Error('Order creation failed on the server.');
      }
    } catch (err) {
      setSagaState('FAILED');
      setSagaErrorMsg(err.message || 'Gateway connection timeout or microservice unreachable.');
    }
  };

  const startSagaPolling = (orderId) => {
    let currentPolls = 0;
    const interval = setInterval(async () => {
      currentPolls++;
      setPollCount(currentPolls);
      
      try {
        const updatedOrder = await apiFetch(`/api/orders/${orderId}`);
        if (updatedOrder) {
          const status = updatedOrder.status; // PENDING, PAID, CANCELLED, etc.
          
          if (status === 'PAID') {
            clearInterval(interval);
            setSagaState('SUCCESS');
            clearCart(); // Clear local Redis-backed cart upon success
          } else if (status === 'CANCELLED') {
            clearInterval(interval);
            setSagaState('FAILED');
            setSagaErrorMsg(
              updatedOrder.totalAmount > 5000 
                ? 'Saga rolled back: Total amount exceeds the $5,000 credit threshold.' 
                : 'Saga rolled back: Inventory stock unavailable or card authorization rejected.'
            );
          }
        }
      } catch (err) {
        console.error('Failed to poll order status:', err);
      }

      // Safeguard timeout (stop polling after 15 attempts, approx 12 seconds)
      if (currentPolls >= 15) {
        clearInterval(interval);
        setSagaState('FAILED');
        setSagaErrorMsg('Saga orchestrator timeout. Order transaction is left pending on background schedules.');
      }
    }, 800); // Poll every 800ms
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Secure Orchestrated Checkout</h1>

      <div className={styles.layoutGrid}>
        {/* Left Column: Form Details */}
        <div className={`${styles.formColumn} glass-panel`}>
          <form onSubmit={handlePlaceOrder} className={styles.form}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionNum}>01</span>
              <h3>Shipping Destination</h3>
            </div>
            
            <div className={styles.row}>
              <div className={styles.inputGroup}>
                <label>Recipient Name</label>
                <input 
                  type="text" 
                  placeholder="John Doe" 
                  value={shippingName}
                  onChange={(e) => setShippingName(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.inputGroup}>
                <label>Street Address</label>
                <input 
                  type="text" 
                  placeholder="100 Silicon Way, Suite 400" 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className={styles.rowTwoCol}>
              <div className={styles.inputGroup}>
                <label>City / State</label>
                <input 
                  type="text" 
                  placeholder="San Francisco, CA" 
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required 
                />
              </div>
              <div className={styles.inputGroup}>
                <label>Zip Code</label>
                <input 
                  type="text" 
                  placeholder="94107" 
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className={styles.sectionHeader} style={{ marginTop: '24px' }}>
              <span className={styles.sectionNum}>02</span>
              <h3>Vault Card Authorization</h3>
            </div>

            <div className={styles.row}>
              <div className={styles.inputGroup}>
                <label>Card Number (Transactions &gt; $5000 trigger a simulated Payment Reject)</label>
                <input 
                  type="text" 
                  placeholder="4111 2222 3333 4444" 
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className={styles.rowTwoCol}>
              <div className={styles.inputGroup}>
                <label>Expiration</label>
                <input 
                  type="text" 
                  placeholder="12/28" 
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  required 
                />
              </div>
              <div className={styles.inputGroup}>
                <label>CVV</label>
                <input 
                  type="password" 
                  placeholder="•••" 
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value)}
                  required 
                />
              </div>
            </div>

            <button type="submit" className={styles.placeOrderBtn}>
              ⚡ Authorize Order & Place Checkout
            </button>
          </form>
        </div>

        {/* Right Column: Order Summary */}
        <div className={`${styles.summaryColumn} glass-panel`}>
          <h3>Order Summary</h3>
          <div className={styles.cartItems}>
            {cart.items.map((item) => (
              <div key={item.productId} className={styles.summaryItem}>
                <div className={styles.itemMeta}>
                  <p className={styles.itemName}>{item.name}</p>
                  <p className={styles.itemQty}>Qty: {item.quantity} &times; {formatPrice(item.price)}</p>
                </div>
                <span className={styles.itemTotal}>{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div className={styles.divider}></div>

          <div className={styles.costRows}>
            <div className={styles.costRow}>
              <span>Subtotal</span>
              <span>{formatPrice(cart.totalAmount)}</span>
            </div>
            <div className={styles.costRow}>
              <span>Shipping</span>
              <span className={styles.freeBadge}>FREE</span>
            </div>
            <div className={styles.costRow}>
              <span>Tax (Simulated 8.5%)</span>
              <span>{formatPrice(cart.totalAmount * 0.085)}</span>
            </div>
            <div className={`${styles.costRow} ${styles.grandTotalRow}`}>
              <span>Total Amount</span>
              <span className={styles.grandPrice}>{formatPrice(cart.totalAmount * 1.085)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SAGA Orchestrator Simulator Overlay */}
      {checkoutActive && (
        <div className={styles.sagaOverlay}>
          <div className={`${styles.sagaCard} glass-panel`}>
            <div className={styles.sagaHeader}>
              <div className={styles.pulsingHex}>✦</div>
              <h2>Event-Driven Saga Orchestrator Dashboard</h2>
              <p>Visualizing RabbitMQ event orchestration state loops in real-time.</p>
            </div>

            <div className={styles.sagaSteps}>
              {/* Step 1: Submit to Order Service */}
              <div className={`${styles.sagaStep} ${
                sagaState === 'SUBMITTING' ? styles.stepActive : 
                sagaState !== 'START' ? styles.stepDone : ''
              }`}>
                <div className={styles.stepIndicator}>
                  {sagaState === 'SUBMITTING' ? <div className={styles.miniSpinner}></div> : '✓'}
                </div>
                <div className={styles.stepInfo}>
                  <h4>1. Submit Checkout to Order Service</h4>
                  <p>Order compiled in Postgres, status set to <code>PENDING</code>. Emits <code>ORDER_CREATED</code> event.</p>
                </div>
              </div>

              {/* Step 2: Payment Authorization */}
              <div className={`${styles.sagaStep} ${
                sagaState === 'PAYMENT_PENDING' ? styles.stepActive : 
                sagaState === 'SUCCESS' ? styles.stepDone : 
                sagaState === 'FAILED' && sagaOrderId ? styles.stepFail : ''
              }`}>
                <div className={styles.stepIndicator}>
                  {sagaState === 'PAYMENT_PENDING' ? <div className={styles.miniSpinner}></div> : 
                   sagaState === 'SUCCESS' ? '✓' : 
                   sagaState === 'FAILED' && sagaOrderId ? '✗' : '—'}
                </div>
                <div className={styles.stepInfo}>
                  <h4>2. Authorize Charge via Payment Service</h4>
                  <p>Consumes <code>ORDER_CREATED</code>. Validates $5,000 threshold. Emits <code>PAYMENT_COMPLETED</code> or <code>PAYMENT_FAILED</code>.</p>
                </div>
              </div>

              {/* Step 3: Inventory Reservation */}
              <div className={`${styles.sagaStep} ${
                sagaState === 'PAYMENT_PENDING' ? styles.stepActive : 
                sagaState === 'SUCCESS' ? styles.stepDone : 
                sagaState === 'FAILED' && sagaOrderId ? styles.stepFail : ''
              }`}>
                <div className={styles.stepIndicator}>
                  {sagaState === 'PAYMENT_PENDING' ? <div className={styles.miniSpinner}></div> : 
                   sagaState === 'SUCCESS' ? '✓' : 
                   sagaState === 'FAILED' && sagaOrderId ? '✗' : '—'}
                </div>
                <div className={styles.stepInfo}>
                  <h4>3. Verify Stock hold via Inventory Service</h4>
                  <p>Locks PostgreSQL stock quantities. Rolls back reservations if <code>PAYMENT_FAILED</code> or timeout sweep occurs.</p>
                </div>
              </div>

              {/* Step 4: Saga Completion */}
              <div className={`${styles.sagaStep} ${
                sagaState === 'SUCCESS' ? styles.stepDone : 
                sagaState === 'FAILED' ? styles.stepFail : ''
              }`}>
                <div className={styles.stepIndicator}>
                  {sagaState === 'SUCCESS' ? '✓' : sagaState === 'FAILED' ? '✗' : '—'}
                </div>
                <div className={styles.stepInfo}>
                  <h4>4. Orchestration Completion</h4>
                  <p>Order Service consumes payment results. Transitions status to <code>PAID</code> or <code>CANCELLED</code>.</p>
                </div>
              </div>
            </div>

            {/* Poll status indicator */}
            {sagaState === 'PAYMENT_PENDING' && (
              <div className={styles.pollCounter}>
                <span className={styles.pulseGlow}></span>
                Polling database transaction state (Attempt {pollCount} of 15)...
              </div>
            )}

            {/* Final Outcome Details */}
            {sagaState === 'SUCCESS' && (
              <div className={styles.outcomeSuccess}>
                <h3>✅ Transaction Completed Successfully!</h3>
                <p>The choreographed Saga has committed all states. Order #{sagaOrderId} is confirmed as <code>PAID</code> and cart has been cleared.</p>
                <div className={styles.actionRow}>
                  <button className={styles.dashboardBtn} onClick={() => router.push('/orders')}>
                    View My Orders
                  </button>
                  <button className={styles.secondaryBtn} onClick={() => router.push('/')}>
                    Continue Shopping
                  </button>
                </div>
              </div>
            )}

            {sagaState === 'FAILED' && (
              <div className={styles.outcomeFail}>
                <h3>❌ Saga Transaction Rolled Back</h3>
                <p>{sagaErrorMsg}</p>
                <div className={styles.actionRow}>
                  <button className={styles.retryBtn} onClick={() => setCheckoutActive(false)}>
                    Return to Checkout
                  </button>
                  <button className={styles.secondaryBtn} onClick={() => router.push('/')}>
                    Continue Shopping
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
