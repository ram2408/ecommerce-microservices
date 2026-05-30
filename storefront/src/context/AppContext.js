'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch, getAuthToken, setAuthToken, getAuthUser, setAuthUser } from '../utils/api';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [cart, setCart] = useState({ items: [], totalAmount: 0 });
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load initial session on client mount
  useEffect(() => {
    const loadedToken = getAuthToken();
    const loadedUser = getAuthUser();
    
    if (loadedToken && loadedUser) {
      setToken(loadedToken);
      setUser(loadedUser);
      // Fetch user's cart from Redis
      fetchCart(loadedUser.email);
    }
    setLoading(false);
  }, []);

  const fetchCart = async (userId) => {
    if (!userId) return;
    try {
      const data = await apiFetch(`/api/cart/${userId}`);
      if (data) {
        setCart(data);
      }
    } catch (err) {
      console.error('Failed to fetch cart from Redis:', err);
    }
  };

  const loginUser = async (email, password) => {
    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      
      if (response && response.token) {
        const userObj = { email }; // The email is our local user identifier
        setAuthToken(response.token);
        setAuthUser(userObj);
        setToken(response.token);
        setUser(userObj);
        
        // Fetch cart immediately after login
        await fetchCart(email);
        return { success: true };
      }
      return { success: false, error: 'Invalid server response' };
    } catch (err) {
      return { success: false, error: err.message || 'Login failed' };
    }
  };

  const registerUser = async (name, email, password) => {
    try {
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password })
      });
      
      // Auto login after registration
      return await loginUser(email, password);
    } catch (err) {
      return { success: false, error: err.message || 'Registration failed' };
    }
  };

  const logoutUser = () => {
    setAuthToken(null);
    setAuthUser(null);
    setToken(null);
    setUser(null);
    setCart({ items: [], totalAmount: 0 });
    setCartDrawerOpen(false);
  };

  const addToCart = async (product, quantity = 1) => {
    if (!user) {
      setCartDrawerOpen(false);
      // Let the caller redirect or show an alert to log in
      throw new Error('Please log in to add items to your cart.');
    }
    
    try {
      const requestBody = {
        productId: product.id,
        name: product.name,
        quantity: quantity,
        price: product.price
      };
      
      const updatedCart = await apiFetch(`/api/cart/${user.email}/add`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      
      if (updatedCart) {
        setCart(updatedCart);
      }
      return true;
    } catch (err) {
      console.error('Failed to add item to cart:', err);
      throw err;
    }
  };

  const removeFromCart = async (productId) => {
    if (!user) return;
    try {
      const updatedCart = await apiFetch(`/api/cart/${user.email}/remove/${productId}`, {
        method: 'POST'
      });
      if (updatedCart) {
        setCart(updatedCart);
      }
    } catch (err) {
      console.error('Failed to remove item from cart:', err);
    }
  };

  const clearCart = async () => {
    if (!user) return;
    try {
      await apiFetch(`/api/cart/${user.email}`, {
        method: 'DELETE'
      });
      setCart({ items: [], totalAmount: 0 });
    } catch (err) {
      console.error('Failed to clear cart:', err);
    }
  };

  return (
    <AppContext.Provider value={{
      user,
      token,
      cart,
      loading,
      cartDrawerOpen,
      setCartDrawerOpen,
      loginUser,
      registerUser,
      logoutUser,
      addToCart,
      removeFromCart,
      clearCart,
      fetchCart: () => fetchCart(user?.email)
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
