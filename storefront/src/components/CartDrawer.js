'use client';

import React from 'react';
import { useApp } from '../context/AppContext';
import { useRouter } from 'next/navigation';
import styles from './CartDrawer.module.css';

export default function CartDrawer() {
  const { cart, cartDrawerOpen, setCartDrawerOpen, addToCart, removeFromCart } = useApp();
  const router = useRouter();

  if (!cartDrawerOpen) return null;

  const handleCheckout = () => {
    setCartDrawerOpen(false);
    router.push('/checkout');
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  return (
    <div className={styles.overlay} onClick={() => setCartDrawerOpen(false)}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Shopping Cart</h2>
          <button className={styles.closeBtn} onClick={() => setCartDrawerOpen(false)}>
            &times;
          </button>
        </div>

        <div className={styles.content}>
          {cart.items.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🛒</div>
              <p>Your cart is empty</p>
              <button 
                className={styles.shopBtn} 
                onClick={() => setCartDrawerOpen(false)}
              >
                Start Shopping
              </button>
            </div>
          ) : (
            <div className={styles.itemList}>
              {cart.items.map((item) => (
                <div key={item.productId} className={styles.itemCard}>
                  <div className={styles.itemInfo}>
                    <h4>{item.name}</h4>
                    <p className={styles.itemPrice}>{formatPrice(item.price)}</p>
                  </div>
                  <div className={styles.controls}>
                    <button 
                      className={styles.qtyBtn} 
                      onClick={() => removeFromCart(item.productId)}
                    >
                      -
                    </button>
                    <span className={styles.qty}>{item.quantity}</span>
                    <button 
                      className={styles.qtyBtn} 
                      onClick={() => addToCart({ id: item.productId, name: item.name, price: item.price }, 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.items.length > 0 && (
          <div className={styles.footer}>
            <div className={styles.summaryRow}>
              <span>Subtotal</span>
              <span className={styles.totalAmount}>{formatPrice(cart.totalAmount)}</span>
            </div>
            <button className={styles.checkoutBtn} onClick={handleCheckout}>
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
