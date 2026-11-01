import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { userAPI } from '../../config/api';
import { getNetworkStatus, subscribeNetworkStatus } from '../../services/networkStatus';
import { activityQuery, checkedActivityPage, mergeActivity } from './activityModel';

const LIMIT = 20;
const empty = { items: [], pagination: null, loading: true, refreshing: false, loadingMore: false, error: '', key: null, uid: null };
export default function useActivityFeed(uid, filters, navigation) {
  const key = JSON.stringify(filters);
  const [state, setState] = useState(empty);
  const current = useRef(state);
  current.current = state;
  const generation = useRef(0);
  const mounted = useRef(false);
  const inFlight = useRef(null);
  const load = useCallback(async (reset = true, clear = false) => {
    if (!mounted.current || !uid) return;
    if (!reset && (inFlight.current || !current.current.pagination?.hasMore || current.current.key !== key)) return;
    const version = reset ? ++generation.current : generation.current;
    const offset = reset ? 0 : current.current.pagination.offset + current.current.pagination.limit;
    const identity = {};
    inFlight.current = identity;
    setState(previous => ({ ...(clear ? empty : previous), key, uid, error: '', loading: clear,
      refreshing: reset && !clear, loadingMore: !reset }));
    try {
      const query = activityQuery(JSON.parse(key));
      const { data } = await userAPI.getTransactions({ ...query, offset, limit: LIMIT });
      const result = checkedActivityPage(data, uid, offset, LIMIT);
      if (mounted.current && version === generation.current) setState(previous => ({ ...previous,
        items: mergeActivity(reset ? [] : previous.items, result.transactions), pagination: result.pagination, error: '' }));
    } catch (failure) {
      if (mounted.current && version === generation.current) setState(previous => ({ ...previous,
        error: failure?.response?.data?.error || failure?.message || 'Activity could not be loaded. Try again.' }));
    } finally {
      if (inFlight.current === identity) inFlight.current = null;
      if (mounted.current && version === generation.current) setState(previous => ({ ...previous, loading: false, refreshing: false, loadingMore: false }));
    }
  }, [uid, key]);
  useEffect(() => {
    mounted.current = true;
    load(true, true);
    let focused = navigation?.isFocused?.() !== false;
    let foreground = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    const focus = navigation?.addListener?.('focus', () => { focused = true; load(true); });
    const blur = navigation?.addListener?.('blur', () => { focused = false; });
    const app = AppState.addEventListener('change', value => { foreground = value === 'active'; if (foreground && focused) load(true); });
    let network = getNetworkStatus();
    const unsubscribe = subscribeNetworkStatus(() => {
      const next = getNetworkStatus();
      const reconnected = network === 'unreachable' && next === 'reachable';
      network = next;
      if (reconnected && focused && foreground) load(true);
    });
    return () => { mounted.current = false; generation.current += 1; inFlight.current = null; focus?.(); blur?.(); app.remove(); unsubscribe(); };
  }, [load, navigation]);
  // A changed account/filter never renders the preceding response even for one
  // render while its effect starts. Late page and refresh responses are ignored.
  const visible = state.uid === uid && state.key === key ? state : empty;
  return { ...visible, refresh: () => load(true), loadMore: () => load(false) };
}
