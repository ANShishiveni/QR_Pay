import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { userAPI } from '../config/api';
import { useAuth } from './AuthContext';
import { checkedNotifications } from '../features/notifications/notificationModel';
import { getNetworkStatus, subscribeNetworkStatus } from '../services/networkStatus';

const NotificationContext = createContext(null);
const emptyState = uid => ({ uid, items: [], loading: Boolean(uid), refreshing: false, error: '', markError: '', readingIds: [] });
export function useNotifications() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error('useNotifications must be used within a NotificationProvider');
  return value;
}

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const alertsEnabled = Boolean(uid) && user?.preferences?.notifications !== false;
  const [state, setState] = useState(() => emptyState(uid));
  const currentUid = useRef(uid);
  currentUid.current = uid;
  const currentItems = useRef([]);
  currentItems.current = state.uid === uid ? state.items : [];
  const mounted = useRef(false);
  const generation = useRef(0);
  const sequence = useRef(0);
  const inFlight = useRef(null);
  const pendingMarks = useRef(new Map());
  const markQueue = useRef(Promise.resolve());
  const active = useCallback(epoch => mounted.current && currentUid.current === uid && generation.current === epoch, [uid]);

  const refresh = useCallback((force = false) => {
    if (!uid || !mounted.current || currentUid.current !== uid) return Promise.resolve(null);
    if (inFlight.current && !force) return inFlight.current;
    const epoch = generation.current;
    const requestSequence = ++sequence.current;
    setState(previous => ({ ...previous, refreshing: true }));
    const promise = Promise.resolve().then(() => userAPI.getNotifications()).then(response => {
      const items = checkedNotifications(response.data, uid);
      if (!active(epoch) || sequence.current !== requestSequence) return null;
      setState(previous => ({ ...previous, uid, items, error: '' }));
      return items;
    }).catch(() => {
      if (active(epoch) && sequence.current === requestSequence) setState(previous => ({ ...previous, error: 'Your inbox could not be refreshed. Reconnect and try again.' }));
      return null;
    }).finally(() => {
      if (active(epoch) && sequence.current === requestSequence) {
        inFlight.current = null;
        setState(previous => ({ ...previous, loading: false, refreshing: false }));
      }
    });
    inFlight.current = promise;
    return promise;
  }, [uid, active]);

  const markRead = useCallback(id => {
    if (!uid || !mounted.current || currentUid.current !== uid) return Promise.resolve(false);
    const item = currentItems.current.find(entry => entry.id === id);
    if (!item) return Promise.resolve(false);
    if (item.readAt) return Promise.resolve(true);
    if (pendingMarks.current.has(id)) return pendingMarks.current.get(id);
    const epoch = generation.current;
    setState(previous => ({ ...previous, markError: '', readingIds: [...previous.readingIds, id] }));
    // Serialize read markers so their reconciliation reads cannot invalidate
    // each other. A duplicate tap on one item still shares the same promise.
    const promise = markQueue.current.then(async () => {
      if (!active(epoch)) return false;
      try { await userAPI.markNotificationRead(id); } catch { /* Reconcile a lost response with the inbox. */ }
      if (!active(epoch)) return false;
      const items = await refresh(true);
      if (!active(epoch)) return false;
      const confirmed = Boolean(items?.find(entry => entry.id === id)?.readAt);
      if (!confirmed) setState(previous => ({ ...previous, markError: 'We couldn’t confirm that this update was marked as read. Refresh the inbox or try again.' }));
      return confirmed;
    }).finally(() => {
      if (active(epoch)) {
        pendingMarks.current.delete(id);
        setState(previous => ({ ...previous, readingIds: previous.readingIds.filter(value => value !== id) }));
      }
    });
    markQueue.current = promise.catch(() => false);
    pendingMarks.current.set(id, promise);
    return promise;
  }, [uid, active, refresh]);

  useEffect(() => {
    mounted.current = true;
    generation.current += 1;
    sequence.current += 1;
    inFlight.current = null;
    pendingMarks.current = new Map();
    markQueue.current = Promise.resolve();
    setState(emptyState(uid));
    let foreground = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    if (uid && foreground) refresh();
    const listener = AppState.addEventListener('change', next => {
      const wasForeground = foreground;
      foreground = next === 'active';
      if (uid && foreground && !wasForeground) refresh();
    });
    const timer = setInterval(() => { if (uid && foreground) refresh(); }, 30000);
    let network = getNetworkStatus();
    const unsubscribeNetwork = subscribeNetworkStatus(() => {
      const next = getNetworkStatus();
      if (network === 'unreachable' && next === 'reachable' && uid && foreground) refresh();
      network = next;
    });
    return () => {
      mounted.current = false;
      generation.current += 1;
      sequence.current += 1;
      inFlight.current = null;
      pendingMarks.current.clear();
      listener.remove();
      unsubscribeNetwork();
      clearInterval(timer);
    };
  }, [uid, refresh]);

  // The render guard removes the previous account's inbox before effects run.
  const visible = state.uid === uid ? state : emptyState(uid);
  const inboxUnreadCount = visible.items.filter(item => !item.readAt).length;
  return <NotificationContext.Provider value={{ ...visible, alertsEnabled, inboxUnreadCount,
    unreadCount: alertsEnabled ? inboxUnreadCount : 0, refresh, markRead }}>
    {children}
  </NotificationContext.Provider>;
}
