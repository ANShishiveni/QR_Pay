import React, { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import apiClient from '../config/api';
import { getNetworkStatus, setNetworkStatus, subscribeNetworkStatus } from '../services/networkStatus';

const NetworkContext = createContext({ status: 'unknown', checking: false, retry: async () => false });
export const useNetwork = () => useContext(NetworkContext);

export function NetworkProvider({ children }) {
  const status = useSyncExternalStore(subscribeNetworkStatus, getNetworkStatus, () => 'unknown');
  const [checking, setChecking] = useState(false);
  const inFlight = useRef(null);
  const mounted = useRef(false);
  const retry = useCallback(() => {
    if (inFlight.current) return inFlight.current;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.onLine === false) {
      setNetworkStatus('unreachable'); return Promise.resolve(false);
    }
    if (mounted.current) setChecking(true);
    const operation = apiClient.get('/health').then(() => {
      setNetworkStatus('reachable'); return true;
    }).catch(() => false).finally(() => {
      inFlight.current = null;
      if (mounted.current) setChecking(false);
    });
    inFlight.current = operation;
    return operation;
  }, []);
  useEffect(() => {
    mounted.current = true;
    let foreground = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    const active = AppState.addEventListener('change', value => { foreground = value === 'active'; if (foreground) retry(); });
    const online = () => { if (foreground) retry(); };
    const offline = () => setNetworkStatus('unreachable');
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('online', online); window.addEventListener('offline', offline);
    }
    // Reconnection probes are reads only. Failed writes are never replayed.
    const timer = setInterval(() => { if (foreground && getNetworkStatus() === 'unreachable') retry(); }, 15000);
    return () => {
      mounted.current = false; active.remove(); clearInterval(timer);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('online', online); window.removeEventListener('offline', offline);
      }
    };
  }, [retry]);
  return <NetworkContext.Provider value={{ status, checking, retry }}>{children}</NetworkContext.Provider>;
}
