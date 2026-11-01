import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import preferences from '../utils/asyncStorage';
import { createAppTheme } from '../styles/theme';

const modes = ['light', 'dark', 'system'];
const fallback = { ...createAppTheme(false), mode: 'system', setMode: async () => {}, reduceMotion: true, appearanceReady: true };
const ThemeContext = createContext(fallback);
export const useAppTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children, preference, storage = preferences }) {
  const systemScheme = useColorScheme();
  const [mode, setAppearance] = useState('system');
  const [appearanceReady, setAppearanceReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);
  const preferenceRef = useRef(preference);
  preferenceRef.current = preference;

  useEffect(() => {
    let mounted = true;
    storage.getItem('appearance').then(saved => {
      if (mounted) {
        const requested = modes.includes(preferenceRef.current) ? preferenceRef.current : saved;
        if (modes.includes(requested)) setAppearance(requested);
      }
    }).catch(() => {}).finally(() => { if (mounted) setAppearanceReady(true); });
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; listener.remove(); };
  }, [storage]);

  useEffect(() => {
    if (modes.includes(preference)) setAppearance(preference);
  }, [preference]);

  const setMode = useCallback(async value => {
    if (!modes.includes(value)) throw new Error('Choose light, dark, or system appearance.');
    await storage.setItem('appearance', value);
    setAppearance(value);
  }, [storage]);
  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
  const value = useMemo(() => ({ ...createAppTheme(isDark), mode, setMode, reduceMotion, appearanceReady }),
    [isDark, mode, setMode, reduceMotion, appearanceReady]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
