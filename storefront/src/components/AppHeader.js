'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '../context/AppContext';

export default function AppHeader() {
  const { user, logoutUser, cart, setCartDrawerOpen } = useApp();
  const pathname = usePathname();
  const router = useRouter();

  const totalItems = cart.items.reduce((acc, item) => acc + item.quantity, 0);
  const isActive = (path) => pathname === path;

  return (
    <header className="main-header glass-panel">
      <div className="header-container">
        <Link href="/" className="logo-area">
          <span className="logo-glow">✦</span>
          <span className="logo-text">AURA</span>
          <span className="logo-sub">STORE</span>
        </Link>

        <nav className="nav-links">
          <Link href="/" className={`nav-item ${isActive('/') ? 'active' : ''}`}>
            Catalog
          </Link>
          {user && (
            <Link href="/orders" className={`nav-item ${isActive('/orders') ? 'active' : ''}`}>
              My Orders
            </Link>
          )}
          {user && user.role === 'VENDOR' && (
            <Link href="/vendor" className={`nav-item ${isActive('/vendor') ? 'active' : ''}`}>
              Vendor Portal
            </Link>
          )}
        </nav>

        <div className="header-actions">
          {/* Cart Icon with count */}
          <button 
            className="cart-trigger" 
            onClick={() => user ? setCartDrawerOpen(true) : router.push('/auth')}
            aria-label="Open Cart"
          >
            <span className="cart-icon">🛒</span>
            {totalItems > 0 && (
              <span className="cart-badge pulse-anim">{totalItems}</span>
            )}
          </button>

          {/* User auth badge */}
          {user ? (
            <div className="profile-chip">
              <span className="avatar">👤</span>
              <span className="email-label">{user.email}</span>
              <button className="logout-btn" onClick={logoutUser}>
                Sign Out
              </button>
            </div>
          ) : (
            <Link href="/auth" className="login-btn">
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
