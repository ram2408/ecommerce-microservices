'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { apiFetch } from '../../utils/api';
import { useRouter } from 'next/navigation';
import styles from './orders.module.css';

export default function OrdersPage() {
  const { user } = useApp();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const router = useRouter();

  const fetchOrders = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      // Endpoint: GET /api/orders/user/{userId}
      const data = await apiFetch(`/api/orders/user/${user.email}`);
      if (data) {
        // Sort orders chronologically, newest first
        const sorted = data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setOrders(sorted);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      setError('Failed to query order database. Ensure Gateway is responsive.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      router.push('/auth');
      return;
    }
    fetchOrders();
  }, [user, router, fetchOrders]);

  const toggleExpandOrder = (orderId) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
    } else {
      setExpandedOrderId(orderId);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!user) return null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Secure Order History Audit</h1>
        <p className={styles.subtitle}>Audit transaction logs and real-time Saga status records.</p>
      </div>

      {error && <div className={styles.errorAlert}>{error}</div>}

      {loading ? (
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner}></div>
          <p>Querying Order Database...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className={`${styles.emptyState} glass-panel`}>
          <div className={styles.emptyIcon}>📂</div>
          <h3>No Transactions Logged</h3>
          <p>You have not placed any orders inside our microservices environment yet.</p>
          <button className={styles.shopBtn} onClick={() => router.push('/')}>
            Return to Catalog
          </button>
        </div>
      ) : (
        <div className={styles.orderList}>
          {orders.map((order) => {
            const isExpanded = expandedOrderId === order.id;
            
            // Map statuses to CSS classes
            let statusClass = styles.pending;
            if (order.status === 'PAID' || order.status === 'COMPLETED') statusClass = styles.paid;
            if (order.status === 'CANCELLED') statusClass = styles.cancelled;
            
            return (
              <div 
                key={order.id} 
                className={`${styles.orderCard} glass-panel ${isExpanded ? styles.expandedCard : ''}`}
              >
                {/* Order Summary Row */}
                <div className={styles.summaryRow} onClick={() => toggleExpandOrder(order.id)}>
                  <div className={styles.metaCol}>
                    <span className={styles.orderIdLabel}>ORDER TRANSACTION</span>
                    <span className={styles.orderId}>#{order.id}</span>
                  </div>
                  
                  <div className={styles.dateCol}>
                    <span className={styles.metaLabel}>PLACED AT</span>
                    <span className={styles.metaVal}>{formatDate(order.createdAt)}</span>
                  </div>

                  <div className={styles.amountCol}>
                    <span className={styles.metaLabel}>TOTAL VALUE</span>
                    <span className={styles.amount}>{formatPrice(order.totalAmount)}</span>
                  </div>

                  <div className={styles.statusCol}>
                    <span className={`${styles.statusBadge} ${statusClass}`}>
                      {order.status}
                    </span>
                  </div>

                  <button className={`${styles.expandBtn} ${isExpanded ? styles.expandActive : ''}`}>
                    ▼
                  </button>
                </div>

                {/* Expanded Details Section */}
                {isExpanded && (
                  <div className={styles.detailsSection}>
                    <div className={styles.itemsHeader}>
                      <span>Purchased Line Items</span>
                      <div className={styles.dividerLine}></div>
                    </div>
                    
                    <div className={styles.itemsList}>
                      {order.items && order.items.map((item) => (
                        <div key={item.id} className={styles.itemRow}>
                          <div className={styles.itemNameCol}>
                            <h4>{item.name || `Product ID: ${item.productId}`}</h4>
                            <p>Catalog Identifier: <code>{item.productId}</code></p>
                          </div>
                          <div className={styles.itemQtyCol}>
                            <span>Qty: {item.quantity}</span>
                          </div>
                          <div className={styles.itemPriceCol}>
                            <span>{formatPrice(item.price)}</span>
                          </div>
                          <div className={styles.itemTotalCol}>
                            <span>{formatPrice(item.price * item.quantity)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className={styles.auditFooter}>
                      <p>🔒 Audit signature: <code>SHA256-{order.userId}-{order.id}</code></p>
                      <button 
                        className={styles.refreshStatusBtn} 
                        onClick={(e) => {
                          e.stopPropagation();
                          fetchOrders();
                        }}
                      >
                        🔄 Refresh Audit Log
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
