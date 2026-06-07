'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { apiFetch } from '../../utils/api';
import { useRouter } from 'next/navigation';
import styles from './vendor.module.css';

export default function VendorPortal() {
  const { user } = useApp();
  const router = useRouter();

  const [products, setProducts] = useState([]);
  const [stockMap, setStockMap] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Product Form States
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState('Electronics');
  const [prodPrice, setProdPrice] = useState('');
  const [prodDescription, setProdDescription] = useState('');
  const [prodImageUrl, setProdImageUrl] = useState('');
  const [prodStock, setProdStock] = useState('50');

  // Inline stock edits
  const [editStockValues, setEditStockValues] = useState({});

  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Categories list
  const categories = ['Electronics', 'Apparel', 'Books', 'Home'];

  useEffect(() => {
    if (!user) {
      router.push('/auth');
      return;
    }
    if (user.role !== 'VENDOR') {
      return; // Access denied displayed below
    }

    fetchVendorData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router]);

  const fetchVendorData = async () => {
    setLoading(true);
    try {
      // 1. Fetch products owned by vendor
      const prodList = await apiFetch(`/api/products?vendorId=${user.email}`);
      setProducts(prodList || []);

      // 2. Fetch inventory stock map for this vendor
      const invList = await apiFetch(`/api/inventory?vendorId=${user.email}`);
      const mapping = {};
      if (invList) {
        invList.forEach(item => {
          mapping[item.productId] = item.quantity;
        });
      }
      setStockMap(mapping);

      // Pre-fill inline edit values
      const initialEdits = {};
      if (prodList) {
        prodList.forEach(p => {
          initialEdits[p.id] = String(mapping[p.id] ?? 0);
        });
      }
      setEditStockValues(initialEdits);

      // 3. Fetch audit logs for this vendor
      const logList = await apiFetch(`/api/inventory/logs?vendorId=${user.email}`);
      setAuditLogs(logList || []);

    } catch (err) {
      console.error('Failed to load vendor dashboard details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadProduct = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setActionLoading(true);

    if (!prodName || !prodPrice || !prodDescription || !prodStock) {
      setFormError('Please fill in all required fields.');
      setActionLoading(false);
      return;
    }

    try {
      // Step 1: Create product in catalog-service
      const productBody = {
        name: prodName,
        description: prodDescription,
        price: parseFloat(prodPrice),
        imageUrl: prodImageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60',
        category: prodCategory,
        stock: parseInt(prodStock),
        vendorId: user.email
      };

      const createdProduct = await apiFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify(productBody)
      });

      if (!createdProduct || !createdProduct.id) {
        throw new Error('Failed to create catalog product.');
      }

      // Step 2: Establish inventory stock level in inventory-service
      await apiFetch('/api/inventory', {
        method: 'POST',
        body: JSON.stringify({
          productId: createdProduct.id,
          quantity: parseInt(prodStock),
          vendorId: user.email
        })
      });

      setFormSuccess(`Successfully uploaded "${prodName}" with ${prodStock} units!`);
      
      // Reset form
      setProdName('');
      setProdPrice('');
      setProdDescription('');
      setProdImageUrl('');
      setProdStock('50');

      // Refresh dashboard
      await fetchVendorData();

    } catch (err) {
      setFormError(err.message || 'Product upload failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStock = async (productId, productName) => {
    const rawVal = editStockValues[productId];
    const newQty = parseInt(rawVal);
    if (isNaN(newQty) || newQty < 0) {
      alert('Please enter a valid non-negative integer for stock quantity.');
      return;
    }

    try {
      await apiFetch('/api/inventory', {
        method: 'POST',
        body: JSON.stringify({
          productId,
          quantity: newQty,
          vendorId: user.email
        })
      });
      
      // Refresh stock locally and audit log
      setStockMap(prev => ({ ...prev, [productId]: newQty }));
      
      // Refresh dashboard (so log ledger updates)
      const logList = await apiFetch(`/api/inventory/logs?vendorId=${user.email}`);
      setAuditLogs(logList || []);

      alert(`Successfully updated stock for "${productName}" to ${newQty} units!`);
    } catch (err) {
      alert('Failed to update stock: ' + err.message);
    }
  };

  const handleInlineStockChange = (productId, val) => {
    setEditStockValues(prev => ({ ...prev, [productId]: val }));
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const formatDate = (dateString) => {
    try {
      const d = new Date(dateString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString();
    } catch (e) {
      return dateString;
    }
  };

  // Access Denied Screen
  if (user && user.role !== 'VENDOR') {
    return (
      <div className={styles.containerDeny}>
        <div className="glass-panel" style={{ padding: '48px', borderRadius: '20px', maxWidth: '500px', textAlign: 'center' }}>
          <span style={{ fontSize: '3.5rem' }}>🔒</span>
          <h2 style={{ marginTop: '16px', color: 'var(--accent-error)' }}>Access Denied</h2>
          <p style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>
            This portal is restricted to registered **Vendors**. Please log out and sign up with a Vendor account to list your products.
          </p>
          <button 
            className={styles.denyBtn}
            onClick={() => router.push('/')}
            style={{ marginTop: '24px', padding: '12px 24px', background: 'var(--primary)', color: '#FFF', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: 'pointer' }}
          >
            Return to Store
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <span className={styles.badge}>VENDOR MANAGEMENT PLATFORM</span>
          <h1>Welcome, {user?.name || 'Vendor'}</h1>
          <p>Logged in as: <span style={{ color: 'var(--secondary)' }}>{user?.email}</span></p>
        </div>
      </header>

      {loading ? (
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner}></div>
          <p>Loading Vendor Session Metrics...</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {/* Left Column: List Products and Update Stock */}
          <div className={styles.leftCol}>
            <div className={`${styles.card} glass-panel`}>
              <div className={styles.cardHeader}>
                <h2>Active Product Catalog</h2>
                <span className={styles.countBadge}>{products.length} Items Listed</span>
              </div>

              {products.length === 0 ? (
                <div className={styles.emptyProducts}>
                  <p>You have not listed any products yet. Use the form on the right to upload your first product!</p>
                </div>
              ) : (
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Product Details</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Stock Count</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => {
                        const currentStock = stockMap[p.id] ?? 0;
                        return (
                          <tr key={p.id}>
                            <td>
                              <div className={styles.productCell}>
                                <div className={styles.productCellInfo}>
                                  <strong>{p.name}</strong>
                                  <span>ID: {p.id}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className={styles.categoryBadge}>{p.category}</span>
                            </td>
                            <td className={styles.priceCell}>{formatPrice(p.price)}</td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={editStockValues[p.id] ?? ''}
                                onChange={(e) => handleInlineStockChange(p.id, e.target.value)}
                                className={styles.stockInput}
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className={styles.updateBtn}
                                onClick={() => handleUpdateStock(p.id, p.name)}
                              >
                                Save
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Audit Log Ledger */}
            <div className={`${styles.card} glass-panel`} style={{ marginTop: '24px' }}>
              <div className={styles.cardHeader}>
                <h2>Inventory Transaction Ledger (Audit Logs)</h2>
              </div>
              <div className={styles.logList}>
                {auditLogs.length === 0 ? (
                  <p className={styles.emptyLogs}>No inventory logs available yet. Stock modifications will create an audit trail here.</p>
                ) : (
                  auditLogs.map((log) => {
                    let badgeClass = styles.badgeRestocked;
                    if (log.actionType === 'RESERVED') badgeClass = styles.badgeReserved;
                    if (log.actionType === 'COMMITTED') badgeClass = styles.badgeCommitted;
                    if (log.actionType === 'RELEASED') badgeClass = styles.badgeReleased;

                    return (
                      <div key={log.id} className={styles.logItem}>
                        <div className={styles.logHeader}>
                          <span className={`${styles.logBadge} ${badgeClass}`}>{log.actionType}</span>
                          <span className={styles.logTime}>{formatDate(log.timestamp)}</span>
                        </div>
                        <div className={styles.logBody}>
                          <p>
                            Product ID: <code>{log.productId}</code> | Qty: <strong>{log.quantity}</strong>
                          </p>
                          <p className={styles.logDesc}>{log.description}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Upload Product Form */}
          <div className={styles.rightCol}>
            <div className={`${styles.card} glass-panel`}>
              <h2>Upload New Product</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
                Add a new product to the central catalog and initialize its warehouse stock count simultaneously.
              </p>

              {formError && <div className={styles.errorAlert}>{formError}</div>}
              {formSuccess && <div className={styles.successAlert}>{formSuccess}</div>}

              <form onSubmit={handleUploadProduct} className={styles.form}>
                <div className={styles.formGroup}>
                  <label htmlFor="prodName">Product Name *</label>
                  <input
                    type="text"
                    id="prodName"
                    placeholder="e.g. Quantum Laptop"
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="prodCategory">Category *</label>
                  <select
                    id="prodCategory"
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    required
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="prodPrice">Price (USD) *</label>
                  <input
                    type="number"
                    id="prodPrice"
                    placeholder="e.g. 1299.99"
                    step="0.01"
                    min="0.01"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="prodStock">Initial Stock quantity *</label>
                  <input
                    type="number"
                    id="prodStock"
                    placeholder="e.g. 50"
                    min="1"
                    value={prodStock}
                    onChange={(e) => setProdStock(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="prodImageUrl">Image URL</label>
                  <input
                    type="url"
                    id="prodImageUrl"
                    placeholder="e.g. https://images.unsplash.com/..."
                    value={prodImageUrl}
                    onChange={(e) => setProdImageUrl(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="prodDescription">Description *</label>
                  <textarea
                    id="prodDescription"
                    placeholder="Enter detailed tech specifications..."
                    rows="4"
                    value={prodDescription}
                    onChange={(e) => setProdDescription(e.target.value)}
                    required
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className={styles.submitBtn}
                >
                  {actionLoading ? 'Uploading Assets...' : '✦ Upload & Initialize Stock'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
