import { useCallback, useEffect, useRef, useState } from 'react';
import { userAPI } from '../../config/api';

export default function useProfile(navigation) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const mounted = useRef(false);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    try {
      const response = await userAPI.getProfile();
      if (!response.data?.user?.uid) throw new Error('Profile unavailable');
      if (mounted.current && request === sequence.current) { setProfile(response.data.user); setError(''); }
    } catch {
      if (mounted.current && request === sequence.current) setError('We could not load your latest profile. Check your connection and try again.');
    } finally { if (mounted.current && request === sequence.current) setLoading(false); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    refresh();
    const unsubscribe = navigation?.addListener?.('focus', refresh);
    return () => { mounted.current = false; sequence.current += 1; unsubscribe?.(); };
  }, [navigation, refresh]);
  const replace = useCallback(value => { sequence.current += 1; setProfile(value); setError(''); setLoading(false); }, []);
  return { profile, loading, error, refresh, replace };
}
