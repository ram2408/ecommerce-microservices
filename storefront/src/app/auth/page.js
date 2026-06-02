'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useRouter } from 'next/navigation';
import styles from './auth.module.css';

export default function AuthPage() {
  const { loginUser, registerUser, loginWithGoogle, loginWithGithub, user } = useApp();
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const githubClientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
  const hasGoogleKeys = !!googleClientId;
  const hasGithubKeys = !!githubClientId;

  // Handle GitHub OAuth callback code
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (code) {
        // Strip the code from address bar so it doesn't replay on refresh
        window.history.replaceState({}, document.title, window.location.pathname);
        
        setError('');
        const registerFlag = sessionStorage.getItem('isRegistering') === 'true';
        setSuccess(registerFlag ? 'Completing GitHub registration...' : 'Completing GitHub authentication...');
        setSubmitting(true);
        
        loginWithGithub(code, registerFlag)
          .then((result) => {
            if (result.success) {
              setSuccess(registerFlag ? 'GitHub registration successful! Welcome.' : 'GitHub authentication successful! Welcome.');
              setTimeout(() => {
                router.push('/');
              }, 1500);
            } else {
              setError(result.error || 'GitHub login failed.');
              setSubmitting(false);
            }
          })
          .catch((err) => {
            setError(err.message || 'GitHub login failed.');
            setSubmitting(false);
          });
      }
    }
  }, [loginWithGithub, router]);

  // Handle Google OAuth callback id_token
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash && hash.includes('id_token=')) {
        const params = new URLSearchParams(hash.substring(1)); // strip '#'
        const idToken = params.get('id_token');
        if (idToken) {
          // Strip the id_token from the address bar so it doesn't replay on refresh
          window.history.replaceState({}, document.title, window.location.pathname);
          
          setError('');
          const registerFlag = sessionStorage.getItem('isRegistering') === 'true';
          setSuccess(registerFlag ? 'Completing Google registration...' : 'Completing Google authentication...');
          setSubmitting(true);
          
          loginWithGoogle(idToken, registerFlag)
            .then((result) => {
              if (result.success) {
                setSuccess(registerFlag ? 'Google registration successful! Welcome.' : 'Google authentication successful! Welcome.');
                setTimeout(() => {
                  router.push('/');
                }, 1500);
              } else {
                setError(result.error || 'Google login failed.');
                setSubmitting(false);
              }
            })
            .catch((err) => {
              setError(err.message || 'Google login failed.');
              setSubmitting(false);
            });
        }
      }
    }
  }, [loginWithGoogle, router]);

  const handleGoogleRealLogin = () => {
    const redirectUri = window.location.origin + '/auth';
    sessionStorage.setItem('isRegistering', isRegistering ? 'true' : 'false');
    // OpenID Connect Implicit flow to get id_token
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${redirectUri}&response_type=id_token&scope=email%20profile%20openid&nonce=aura${Date.now()}`;
  };

  const handleGithubRealLogin = () => {
    const redirectUri = window.location.origin + '/auth';
    sessionStorage.setItem('isRegistering', isRegistering ? 'true' : 'false');
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${githubClientId}&redirect_uri=${redirectUri}&scope=user:email`;
  };

  const handleMockGoogleLogin = async () => {
    setError('');
    setSuccess(isRegistering ? 'Registering with Google (Dev Mock)...' : 'Authenticating with Google (Dev Mock)...');
    setSubmitting(true);
    try {
      const result = await loginWithGoogle('mock-google-token', isRegistering);
      if (result.success) {
        setSuccess(isRegistering ? 'Mock Google registration successful! Welcome.' : 'Mock Google login successful! Welcome.');
        setTimeout(() => {
          router.push('/');
        }, 1500);
      } else {
        setError(result.error);
        setSubmitting(false);
      }
    } catch (err) {
      setError('Mock Google login failed.');
      setSubmitting(false);
    }
  };

  const handleMockGithubLogin = async () => {
    setError('');
    setSuccess(isRegistering ? 'Registering with GitHub (Dev Mock)...' : 'Authenticating with GitHub (Dev Mock)...');
    setSubmitting(true);
    try {
      const result = await loginWithGithub('mock-github-code', isRegistering);
      if (result.success) {
        setSuccess(isRegistering ? 'Mock GitHub registration successful! Welcome.' : 'Mock GitHub login successful! Welcome.');
        setTimeout(() => {
          router.push('/');
        }, 1500);
      } else {
        setError(result.error);
        setSubmitting(false);
      }
    } catch (err) {
      setError('Mock GitHub login failed.');
      setSubmitting(false);
    }
  };

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

        <div className={styles.divider}>
          <span>OR CONTINUE WITH</span>
        </div>

        <div className={styles.socialGroup}>
          {hasGoogleKeys ? (
            <button 
              type="button" 
              onClick={handleGoogleRealLogin} 
              className={styles.socialBtn}
              disabled={submitting}
            >
              <svg className={styles.socialIcon} viewBox="0 0 24 24" width="18" height="18">
                <path fill="#EA4335" d="M12 5.04c1.62 0 3.08.56 4.22 1.65l3.15-3.15C17.45 1.84 14.97 1 12 1 7.35 1 3.39 3.67 1.41 7.56l3.75 2.91C6.04 7.56 8.78 5.04 12 5.04z"/>
                <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.73 2.89c2.18-2 3.7-4.96 3.7-8.62z"/>
                <path fill="#FBBC05" d="M5.16 14.88c-.24-.72-.38-1.49-.38-2.28 0-.79.14-1.56.38-2.28L1.41 7.56C.51 9.35 0 11.35 0 13.5s.51 4.15 1.41 5.94l3.75-2.56z"/>
                <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.73-2.89c-1.11.75-2.53 1.2-4.23 1.2-3.22 0-5.96-2.52-6.93-5.52l-3.75 2.91C3.39 20.33 7.35 23 12 23z"/>
              </svg>
              <span>Google</span>
            </button>
          ) : (
            <button 
              type="button" 
              onClick={handleMockGoogleLogin} 
              className={styles.socialBtn}
              disabled={submitting}
            >
              <svg className={styles.socialIcon} viewBox="0 0 24 24" width="18" height="18">
                <path fill="#EA4335" d="M12 5.04c1.62 0 3.08.56 4.22 1.65l3.15-3.15C17.45 1.84 14.97 1 12 1 7.35 1 3.39 3.67 1.41 7.56l3.75 2.91C6.04 7.56 8.78 5.04 12 5.04z"/>
                <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.73 2.89c2.18-2 3.7-4.96 3.7-8.62z"/>
                <path fill="#FBBC05" d="M5.16 14.88c-.24-.72-.38-1.49-.38-2.28 0-.79.14-1.56.38-2.28L1.41 7.56C.51 9.35 0 11.35 0 13.5s.51 4.15 1.41 5.94l3.75-2.56z"/>
                <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.73-2.89c-1.11.75-2.53 1.2-4.23 1.2-3.22 0-5.96-2.52-6.93-5.52l-3.75 2.91C3.39 20.33 7.35 23 12 23z"/>
              </svg>
              <span>Google (Mock)</span>
            </button>
          )}

          {hasGithubKeys ? (
            <button 
              type="button" 
              onClick={handleGithubRealLogin} 
              className={styles.socialBtn}
              disabled={submitting}
            >
              <svg className={styles.socialIcon} viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.11.82-.26.82-.577v-2.234c-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22v3.293c0 .319.22.694.825.576C20.565 21.795 24 17.3 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              <span>GitHub</span>
            </button>
          ) : (
            <button 
              type="button" 
              onClick={handleMockGithubLogin} 
              className={styles.socialBtn}
              disabled={submitting}
            >
              <svg className={styles.socialIcon} viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.11.82-.26.82-.577v-2.234c-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22v3.293c0 .319.22.694.825.576C20.565 21.795 24 17.3 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              <span>GitHub (Mock)</span>
            </button>
          )}
        </div>

        <div className={styles.toggleFooter}>
          <span>{isRegistering ? 'Already have an identity?' : 'First time interacting?'}</span>
          <button 
            className={styles.toggleBtn} 
            disabled={submitting}
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
