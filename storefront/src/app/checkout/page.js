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

  // Razorpay and Mock Popover states
  const [showMockUpiPopover, setShowMockUpiPopover] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState(null);

  const [selectedUpiApp, setSelectedUpiApp] = useState(null);
  const [upiIdInput, setUpiIdInput] = useState('');
  const [upiMessage, setUpiMessage] = useState('');

  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/auth');
      return;
    }

    // Load Razorpay SDK script dynamically
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    
    return () => {
      document.body.removeChild(script);
    };
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
        setPaymentDetails(order);

        if (order.mockMode) {
          // If running in developer mock fallback mode, open simulated UPI popup
          setSagaState('PAYMENT_PENDING');
          setSelectedUpiApp(null);
          setUpiIdInput('');
          setUpiMessage('');
          setShowMockUpiPopover(true);
        } else {
          // Launch real Razorpay checkout popover
          setSagaState('PAYMENT_PENDING');
          launchRazorpayCheckout(order);
        }
      } else {
        throw new Error('Order creation failed on the server.');
      }
    } catch (err) {
      setSagaState('FAILED');
      setSagaErrorMsg(err.message || 'Gateway connection timeout or microservice unreachable.');
    }
  };

  const handleUpiAppSelect = (appName) => {
    setSelectedUpiApp(appName);
    setUpiIdInput('');
    setUpiMessage(`Payment request successfully sent to your registered ${appName} app. Please check your mobile device notification to approve the ₹1.00 payment.`);
  };

  const handleUpiIdSubmit = (e) => {
    e.preventDefault();
    if (!upiIdInput.trim() || !upiIdInput.includes('@')) {
      setUpiMessage('❌ Please enter a valid UPI ID / VPA (e.g. username@upi)');
      return;
    }
    setSelectedUpiApp(null);
    setUpiMessage(`⚡ UPI Payment request of ₹1.00 successfully dispatched to VPA: "${upiIdInput}". Please open your linked UPI app to approve.`);
  };

  const launchRazorpayCheckout = (order) => {
    const options = {
      key: order.razorpayKeyId,
      amount: 100, // Force 1 Rupee (100 paise) payment for demo
      currency: "INR",
      name: "Aura E-Commerce",
      description: "Secure Saga Checkout Payment (1 Rupee Demo)",
      order_id: order.razorpayOrderId,
      prefill: {
        name: shippingName || user.name || "",
        email: user.email || ""
      },
      handler: async function (response) {
        try {
          // Verify payment signature on backend
          await apiFetch('/api/payments/verify', {
            method: 'POST',
            body: JSON.stringify({
              orderId: order.id,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            })
          });
          // Start polling Order status to visualize Saga completion
          startSagaPolling(order.id);
        } catch (err) {
          setSagaState('FAILED');
          setSagaErrorMsg('Payment verification failed: ' + err.message);
        }
      },
      modal: {
        ondismiss: function () {
          setSagaState('FAILED');
          setSagaErrorMsg('Payment dismissed by user.');
        }
      },
      theme: {
        color: "#0a0a0c"
      }
    };

    if (window.Razorpay) {
      const rzp = new window.Razorpay(options);
      rzp.open();
    } else {
      setSagaState('FAILED');
      setSagaErrorMsg('Razorpay SDK failed to load. Please refresh the page and try again.');
    }
  };

  const handleCompleteMockPayment = async () => {
    if (!paymentDetails) return;
    setShowMockUpiPopover(false);
    
    try {
      // Send mock verification code to backend verify endpoint
      await apiFetch('/api/payments/verify', {
        method: 'POST',
        body: JSON.stringify({
          orderId: paymentDetails.id,
          razorpayOrderId: paymentDetails.razorpayOrderId,
          razorpayPaymentId: 'pay_mock_' + Math.random().toString(36).substring(7),
          razorpaySignature: 'mock_signature'
        })
      });
      // Start polling status to visualize Saga completion
      startSagaPolling(paymentDetails.id);
    } catch (err) {
      setSagaState('FAILED');
      setSagaErrorMsg('Mock verification failed: ' + err.message);
    }
  };

  const handleCancelMockPayment = () => {
    setShowMockUpiPopover(false);
    setSagaState('FAILED');
    setSagaErrorMsg('Payment cancelled by user (simulated close).');
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
                : 'Saga rolled back: Inventory stock unavailable or payment failed/timed out.'
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
              <h3>Real-Time UPI Payment Authorization</h3>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              We support instant UPI transaction processing (QR Code scans, App intent redirects, or VPA collects). Click place order below to authorize payment.
            </p>

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
                  <p>Order compiled in Postgres, status set to <code>PENDING_PAYMENT</code>. Emits <code>ORDER_CREATED</code> event.</p>
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
                  <h4>2. Authorize Charge via UPI Payment Gateway</h4>
                  <p>Initializes Razorpay order. Webhook or client verification triggers <code>PAYMENT_COMPLETED</code> event upon successful authorization.</p>
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

      {/* Simulated UPI Popover Modal */}
      {showMockUpiPopover && paymentDetails && (
        <div className={styles.mockUpiOverlay}>
          <div className={styles.mockUpiCard}>
            <div className={styles.mockUpiHeader}>
              <h3>Aura Secure UPI Payment</h3>
              <p>Simulating UPI scan or app verification</p>
            </div>
            
            <div className={styles.mockUpiAmount}>
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(1)}
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                (1 Rupee Demo Payment — Cart Total: {formatPrice(paymentDetails.totalAmount * 1.085)} USD)
              </span>
            </div>
            
            <div className={styles.mockUpiQrSection}>
              <div className={styles.mockUpiQrBox}>
                <svg width="100%" height="100%" viewBox="0 0 100 100" className={styles.mockUpiQrImage}>
                  {/* Outer boundary */}
                  <rect x="10" y="10" width="80" height="80" fill="none" stroke="#FFF" strokeWidth="2" />
                  {/* Scanner square dots patterns */}
                  <rect x="15" y="15" width="20" height="20" fill="#FFF" />
                  <rect x="19" y="19" width="12" height="12" fill="#0f121d" />
                  <rect x="22" y="22" width="6" height="6" fill="#FFF" />
                  
                  <rect x="65" y="15" width="20" height="20" fill="#FFF" />
                  <rect x="69" y="19" width="12" height="12" fill="#0f121d" />
                  <rect x="72" y="22" width="6" height="6" fill="#FFF" />
                  
                  <rect x="15" y="65" width="20" height="20" fill="#FFF" />
                  <rect x="19" y="69" width="12" height="12" fill="#0f121d" />
                  <rect x="22" y="72" width="6" height="6" fill="#FFF" />
                  
                  {/* Simulated QR payload pixels */}
                  <rect x="42" y="15" width="6" height="6" fill="#FFF" />
                  <rect x="52" y="20" width="6" height="6" fill="#FFF" />
                  <rect x="42" y="30" width="12" height="6" fill="#FFF" />
                  <rect x="45" y="42" width="6" height="12" fill="#FFF" />
                  <rect x="60" y="45" width="12" height="6" fill="#FFF" />
                  <rect x="65" y="60" width="6" height="6" fill="#FFF" />
                  <rect x="50" y="65" width="6" height="12" fill="#FFF" />
                  <rect x="70" y="70" width="12" height="12" fill="#FFF" />
                </svg>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '16px', textAlign: 'center' }}>
                Scan QR Code using any UPI app (GPay, PhonePe, Paytm, BHIM) to authorize
              </p>
            </div>
            
            <div className={styles.mockUpiAppGrid}>
              <div 
                className={`${styles.mockUpiAppBtn} ${selectedUpiApp === 'Google Pay' ? styles.activeApp : ''}`}
                onClick={() => handleUpiAppSelect('Google Pay')}
              >
                <span className={styles.mockUpiAppIcon}>📱</span>
                <span>Google Pay</span>
              </div>
              <div 
                className={`${styles.mockUpiAppBtn} ${selectedUpiApp === 'PhonePe' ? styles.activeApp : ''}`}
                onClick={() => handleUpiAppSelect('PhonePe')}
              >
                <span className={styles.mockUpiAppIcon}>💜</span>
                <span>PhonePe</span>
              </div>
              <div 
                className={`${styles.mockUpiAppBtn} ${selectedUpiApp === 'Paytm' ? styles.activeApp : ''}`}
                onClick={() => handleUpiAppSelect('Paytm')}
              >
                <span className={styles.mockUpiAppIcon}>💙</span>
                <span>Paytm</span>
              </div>
              <div 
                className={`${styles.mockUpiAppBtn} ${selectedUpiApp === 'BHIM' ? styles.activeApp : ''}`}
                onClick={() => handleUpiAppSelect('BHIM')}
              >
                <span className={styles.mockUpiAppIcon}>🇮🇳</span>
                <span>BHIM UPI</span>
              </div>
              <div 
                className={`${styles.mockUpiAppBtn} ${selectedUpiApp === 'Amazon Pay' ? styles.activeApp : ''}`}
                onClick={() => handleUpiAppSelect('Amazon Pay')}
              >
                <span className={styles.mockUpiAppIcon}>💛</span>
                <span>Amazon Pay</span>
              </div>
            </div>

            <div className={styles.mockUpiIdFormContainer}>
              <div className={styles.mockUpiDivider}><span>OR PAY VIA UPI ID</span></div>
              <form onSubmit={handleUpiIdSubmit} className={styles.mockUpiIdForm}>
                <input 
                  type="text" 
                  placeholder="e.g. success@razorpay, username@oksbi" 
                  value={upiIdInput}
                  onChange={(e) => setUpiIdInput(e.target.value)}
                  className={styles.mockUpiInput}
                />
                <button type="submit" className={styles.mockUpiSendBtn}>Send Request</button>
              </form>
            </div>

            {upiMessage && (
              <div className={styles.mockUpiMessageBanner}>
                {upiMessage}
              </div>
            )}
            
            <div className={styles.mockUpiActionRow}>
              <button className={styles.mockUpiSubmitBtn} onClick={handleCompleteMockPayment}>
                Complete Mock Payment (Simulate Capture)
              </button>
              <button className={styles.mockUpiCancelBtn} onClick={handleCancelMockPayment}>
                Cancel Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
