import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { authAPI } from '../config/api';
import { sessionExpiry } from '../config/apiPolicy';
import preferences, { clearSessionCache, setPreferenceUser } from '../utils/asyncStorage';
import sessionStorage from '../services/storage/sessionStorage';
import { onSessionExpired } from '../services/sessionEvents';

const AuthContext = createContext();
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const operation = useRef(0);
  const verifiedUser = useRef(null);

  const lockSession = useCallback(() => {
    operation.current += 1;
    clearSessionCache();
    verifiedUser.current = null;
    setUser(null);
    setExpiresAt(null);
    setIsLoading(false);
    setIsRevalidating(false);
  }, []);

  const acceptVerifiedSession = useCallback((data) => {
    if (data?.valid !== true || typeof data.user?.uid !== 'string') {
      throw new Error('Unable to validate your session. Please sign in again.');
    }
    const expiry = sessionExpiry(data.expiresAt);
    setPreferenceUser(data.user.uid);
    verifiedUser.current = data.user;
    setUser(data.user);
    setExpiresAt(expiry);
    setAuthError(null);
  }, []);

  const checkAuthStatus = useCallback(async ({ background = false } = {}) => {
    const preserveNavigation = background && Boolean(verifiedUser.current);
    const current = ++operation.current;
    if (preserveNavigation) setIsRevalidating(true);
    else setIsLoading(true);
    setAuthError(null);
    try {
      // An interrupted web logout must not revive the still-present cookie.
      if (await preferences.getItem('sessionLogoutPending') === 'true') {
        try { await authAPI.logout(); } catch (error) {
          if (error.response?.status !== 401) throw error;
        }
        await sessionStorage.clearToken();
        await preferences.removeItem('sessionLogoutPending');
        if (operation.current === current) lockSession();
        return;
      }
      if (Platform.OS !== 'web' && !(await sessionStorage.getToken())) {
        if (operation.current === current) lockSession();
        return;
      }
      const response = await authAPI.verifyToken();
      if (operation.current === current) acceptVerifiedSession(response.data);
    } catch (error) {
      if (operation.current === current) {
        if (preserveNavigation && error.response?.status !== 401) {
          // Keep an already verified, unexpired navigation state on temporary
          // connectivity loss. Every mutation still requires server approval;
          // the local expiry timer and definitive 401 both lock immediately.
          setAuthError('Reconnect to verify your session and refresh the latest status.');
        } else {
          clearSessionCache();
          verifiedUser.current = null;
          setUser(null);
          setExpiresAt(null);
        }
        if (!preserveNavigation && error.response?.status !== 401) {
          setAuthError('Your session could not be verified. Check your connection and try again.');
        }
      }
    } finally {
      if (operation.current === current) { setIsLoading(false); setIsRevalidating(false); }
    }
  }, [acceptVerifiedSession, lockSession]);

  const login = useCallback(async (token) => {
    const current = ++operation.current;
    setAuthError(null);
    try {
      await sessionStorage.setToken(token);
      const response = await authAPI.verifyToken();
      if (operation.current !== current) throw new Error('Sign-in was interrupted. Please try again.');
      await preferences.removeItem('sessionLogoutPending');
      acceptVerifiedSession(response.data);
    } catch (error) {
      lockSession();
      try { await sessionStorage.clearToken(); } catch { /* Remain locked. */ }
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [acceptVerifiedSession, lockSession]);

  const logout = useCallback(async () => {
    lockSession();
    // This flag is non-sensitive; the browser's HttpOnly cookie is server-owned.
    try { await preferences.setItem('sessionLogoutPending', 'true'); } catch { /* Still attempt server revocation. */ }
    try {
      try { await authAPI.logout(); } catch (error) {
        if (error.response?.status !== 401) throw error;
      }
      await sessionStorage.clearToken();
      await preferences.removeItem('sessionLogoutPending');
      setAuthError(null);
    } catch (error) {
      try { await sessionStorage.clearToken(); } catch { /* UI remains locked. */ }
      setAuthError('Signed out on this screen. Reconnect to finish ending your server session.');
      throw error;
    }
  }, [lockSession]);

  useEffect(() => {
    const unsubscribe = onSessionExpired(() => {
      lockSession();
      setAuthError('Your session has ended. Please sign in again.');
    });
    checkAuthStatus();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && verifiedUser.current) checkAuthStatus({ background: true });
    });
    return () => { operation.current += 1; unsubscribe(); subscription.remove(); };
  }, [checkAuthStatus, lockSession]);

  useEffect(() => {
    if (!expiresAt) return undefined;
    const timeout = setTimeout(() => {
      lockSession();
      setAuthError('Your session has expired. Please sign in again.');
      sessionStorage.clearToken().catch(() => {});
    }, Math.max(0, Math.min(expiresAt - Date.now(), 2147483647)));
    return () => clearTimeout(timeout);
  }, [expiresAt, lockSession]);

  return (
    <AuthContext.Provider value={{
      isAuthenticated: Boolean(user), isLoading, isRevalidating, user, authError, expiresAt,
      login, logout, checkAuthStatus,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
