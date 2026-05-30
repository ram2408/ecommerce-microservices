'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { apiFetch } from '../utils/api';
import styles from './page.module.css';
import { useRouter } from 'next/navigation';

export default function CatalogPage() {
  const { user, addToCart, setCartDrawerOpen } = useApp();
  const [products, setProducts] = useState([]);
  const [stockLevels, setStockLevels] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const router = useRouter();

  const categories = ['All', 'Electronics', 'Apparel', 'Books', 'Home'];

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/products');
      if (data) {
        setProducts(data);
        // Fetch real-time stock levels for all products from inventory-service
        fetchStockLevels(data);
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStockLevels = async (prodList) => {
    const stockMap = {};
    await Promise.all(
      prodList.map(async (p) => {
        try {
          const res = await apiFetch(`/api/inventory/${p.id}`);
          if (res) {
            stockMap[p.id] = res.stockQuantity;
          }
        } catch (e) {
          // Fallback to catalog service local stock if inventory service fails or is not seeded
          stockMap[p.id] = p.stock !== undefined ? p.stock : 0;
        }
      })
    );
    setStockLevels(stockMap);
  };

  const handleAddToCart = async (product) => {
    setActionError('');
    setSuccessMsg('');
    if (!user) {
      router.push('/auth');
      return;
    }

    const currentStock = stockLevels[product.id] ?? 0;
    if (currentStock <= 0) {
      setActionError(`"${product.name}" is currently out of stock.`);
      return;
    }

    try {
      await addToCart(product, 1);
      setSuccessMsg(`Added "${product.name}" to cart!`);
      setCartDrawerOpen(true);
      // Refresh stock levels in case there are concurrent reservations
      fetchProducts();
    } catch (err) {
      setActionError(err.message || 'Could not add product to cart.');
    }
  };

  const initializeDemoCatalog = async () => {
    setLoading(true);
    setActionError('');
    setSuccessMsg('');
    
    const demoProducts = [
      { name: 'Quantum Nexus Laptop', description: 'Next-gen silicon, 32GB unified memory, liquid cooling and mesh casing.', price: 2499.00, category: 'Electronics', stock: 15, imageUrl: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=500&auto=format&fit=crop&q=60' },
      { name: 'Zenith ANC Headphones', description: 'Active Obsidian noise cancellation, custom audio profile and 40h battery.', price: 349.00, category: 'Electronics', stock: 40, imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60' },
      { name: 'Aura Mesh Sneaker', description: 'Lightweight running shoes built with recycled oceanic glass filament.', price: 180.00, category: 'Apparel', stock: 50, imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&auto=format&fit=crop&q=60' },
      { name: 'Pulse Smart Watch', description: 'Biometric telemetry scanning, always-on micro-LED screen.', price: 299.00, category: 'Electronics', stock: 0, imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60' },
      { name: 'Gravity Mech Keyboard', description: 'Gasket-mounted custom mechanical keyboard with hot-swappable switches.', price: 199.00, category: 'Electronics', stock: 25, imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=60' },
      { name: 'Hyperion Leather Wallet', description: 'RFID blocking, full-grain Italian obsidian tanned leather.', price: 75.00, category: 'Apparel', stock: 100, imageUrl: 'https://images.unsplash.com/photo-1627124765135-56c33fc36baf?w=500&auto=format&fit=crop&q=60' }
    ];

    try {
      for (const p of demoProducts) {
        // 1. Create product in Catalog Service
        const createdProduct = await apiFetch('/api/products', {
          method: 'POST',
          body: JSON.stringify(p)
        });
        
        // 2. Set stock level in Inventory Service
        if (createdProduct && createdProduct.id) {
          await apiFetch('/api/inventory', {
            method: 'POST',
            body: JSON.stringify({
              productId: createdProduct.id,
              quantity: p.stock
            })
          });
        }
      }
      
      setSuccessMsg('Successfully initialized demo products and stock levels!');
      await fetchProducts();
    } catch (err) {
      setActionError(err.message || 'Initialization failed. Make sure all microservices are running.');
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  return (
    <div className={styles.container}>
      {/* Hero Banner */}
      <section className={`${styles.hero} glass-panel`}>
        <div className={styles.heroContent}>
          <span className={styles.tagline}>THE FUTURE OF E-COMMERCE</span>
          <h1>Experience Seamless Orchestrated Sagas</h1>
          <p>Hand-crafted glassmorphism interfaces connecting Auth, Catalog, Cart, Inventory, and Order microservices in real-time.</p>
        </div>
        <div className={styles.heroOverlay}></div>
      </section>

      {/* Control Panel: Filters & Search */}
      <div className={styles.controlsRow}>
        <div className={styles.categoryTabs}>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`${styles.tabBtn} ${selectedCategory === cat ? styles.activeTab : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className={styles.searchWrapper}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search our high-tech catalog..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      {/* Alerts */}
      {actionError && <div className={styles.errorAlert}>{actionError}</div>}
      {successMsg && <div className={styles.successAlert}>{successMsg}</div>}

      {/* Products Grid */}
      {loading ? (
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner}></div>
          <p>Querying Product Database...</p>
        </div>
      ) : products.length === 0 ? (
        <div className={`${styles.emptyCatalog} glass-panel`}>
          <h3>Database Empty</h3>
          <p>No products found in the MongoDB Catalog database.</p>
          <button className={styles.initBtn} onClick={initializeDemoCatalog}>
            ✦ Seed Demo Products & Inventory Stock
          </button>
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            {filteredProducts.map((product) => {
              const stock = stockLevels[product.id] ?? 0;
              const isOutOfStock = stock <= 0;
              
              return (
                <div key={product.id} className={`${styles.card} glass-panel`}>
                  {/* Visual Mesh Placeholder Image */}
                  <div className={styles.imageContainer}>
                    <div className={styles.meshBg} style={{
                      backgroundImage: `radial-gradient(circle at top left, var(--primary) 0%, rgba(${product.category === 'Electronics' ? '6, 182, 212' : '139, 92, 246'}, 0.2) 70%)`
                    }}>
                      <span className={styles.productIcon}>
                        {product.category === 'Electronics' ? '💻' : product.category === 'Apparel' ? '👕' : '🎁'}
                      </span>
                    </div>
                    <span className={`${styles.stockBadge} ${isOutOfStock ? styles.outBadge : styles.inBadge}`}>
                      {isOutOfStock ? 'Sold Out' : `${stock} Units Left`}
                    </span>
                  </div>

                  <div className={styles.cardBody}>
                    <div className={styles.cardMeta}>
                      <span className={styles.categoryChip}>{product.category}</span>
                      <span className={styles.priceTag}>{formatPrice(product.price)}</span>
                    </div>
                    <h3>{product.name}</h3>
                    <p className={styles.description}>{product.description}</p>
                    
                    <button
                      className={`${styles.addBtn} ${isOutOfStock ? styles.outBtn : ''}`}
                      onClick={() => handleAddToCart(product)}
                      disabled={isOutOfStock}
                    >
                      {isOutOfStock ? 'Sold Out' : 'Add To Cart'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className={styles.noResults}>
              <p>No products match your active search or category filters.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
