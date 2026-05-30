'use client';

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useRouter } from 'next/navigation';
import styles from './auth.module.css';

export default function AuthPage() {
  const { loginUser, registerUser, user } = useApp();
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  // If already logged in, redirect home
  if (user) {
    if (typeof window !== 'undefined') {
      router.push('/');
    }
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    if (!email || !password || (isRegistering && !name)) {
      setError('Please fill in all fields.');
      setSubmitting(false);
      return;
    }

    try {
      if (isRegistering) {
        const result = await registerUser(name, email, password);
        if (result.success) {
          setSuccess('Account created successfully! Logging you in...');
          setTimeout(() => {
            router.push('/');
          }, 1500);
        } else {
          setError(result.error);
        }
      } else {
        const result = await loginUser(email, password);
        if (result.success) {
          setSuccess('Authentication successful! Welcome back.');
          setTimeout(() => {
            router.push('/');
          }, 1500);
        } else {
          setError(result.error);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={`${styles.authCard} glass-panel animate-slide-up`}>
        <div className={styles.header}>
          <h2>{isRegistering ? 'Initialize Identity' : 'Access Authorization'}</h2>
          <p>{isRegistering ? 'Register your secure user profile' : 'Sign in to access your secure microservices session'}</p>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}
        {success && <div className={styles.successBanner}>{success}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          {isRegistering && (
            <div className={styles.inputGroup}>
              <label htmlFor="name">Full Name</label>
              <input 
                type="text" 
                id="name" 
                placeholder="John Doe" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className={styles.inputGroup}>
            <label htmlFor="email">Email Address</label>
            <input 
              type="email" 
              id="email" 
              placeholder="user@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password">Password</label>
            <input 
              type="password" 
              id="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button 
            type="submit" 
            className={styles.submitBtn} 
            disabled={submitting}
          >
            {submitting ? 'Processing request...' : isRegistering ? 'Create Secure Profile' : 'Authenticate Credentials'}
          </button>
        </form>

        <div className={styles.toggleFooter}>
          <span>{isRegistering ? 'Already have an identity?' : 'First time interacting?'}</span>
          <button 
            className={styles.toggleBtn} 
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError('');
              setSuccess('');
            }}
          >
            {isRegistering ? 'Sign In Instead' : 'Register Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
