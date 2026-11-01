import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getNetworkStatus, subscribeNetworkStatus } from '../../services/networkStatus';

// Poll only while this screen is focused and the app is in the foreground.
// Sequence numbers keep a slow read from overwriting a later mutation response.
export default function useFocusedResource(load, navigation, intervalMs = 15000) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(false);
  const sequence = useRef(0);
  const inFlight = useRef(null);
  const refresh = useCallback((force = false) => {
    if (inFlight.current && !force) return inFlight.current;
    const current = ++sequence.current;
    if (mounted.current) setRefreshing(true);
    const promise = Promise.resolve().then(load).then(result => {
      if (mounted.current && current === sequence.current) { setData(result); setError(''); }
      return result;
    }).catch(cause => {
      if (mounted.current && current === sequence.current) setError(cause?.response?.data?.error || cause?.message || 'The latest request status is unavailable. Try again.');
      return null;
    }).finally(() => {
      if (current === sequence.current) {
        inFlight.current = null;
        if (mounted.current) { setLoading(false); setRefreshing(false); }
      }
    });
    inFlight.current = promise;
    return promise;
  }, [load]);
  const replace = useCallback(result => {
    sequence.current += 1;
    inFlight.current = null;
    if (mounted.current) { setData(result); setError(''); setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    mounted.current = true;
    setData(null); setLoading(true); setError('');
    let focused = navigation?.isFocused?.() !== false;
    let foreground = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    if (focused && foreground) refresh();
    const focus = navigation?.addListener?.('focus', () => { focused = true; if (foreground) refresh(); });
    const blur = navigation?.addListener?.('blur', () => { focused = false; });
    const lifecycle = AppState.addEventListener('change', state => {
      foreground = state === 'active';
      if (foreground && focused) refresh();
    });
    let network = getNetworkStatus();
    const unsubscribe = subscribeNetworkStatus(() => {
      const next = getNetworkStatus();
      const reconnected = network === 'unreachable' && next === 'reachable';
      network = next;
      if (reconnected && focused && foreground) refresh(true);
    });
    const timer = setInterval(() => { if (focused && foreground) refresh(); }, intervalMs);
    return () => {
      mounted.current = false; sequence.current += 1; inFlight.current = null;
      clearInterval(timer); focus?.(); blur?.(); lifecycle.remove(); unsubscribe();
    };
  }, [navigation, refresh, intervalMs]);
  return { data, loading, refreshing, error, refresh, replace };
}
