import { Platform } from 'react-native';

// RN Web 0.20 does not translate React Native's accessibilityState object.
// Keep the native contract and expose the equivalent DOM state explicitly.
export function accessibilityStateProps(state = {}, role = 'button') {
  const props = { accessibilityState: state };
  if (Platform.OS !== 'web') return props;
  for (const key of ['disabled', 'busy', 'expanded', 'checked']) {
    if (state[key] !== undefined) props[`aria-${key}`] = state[key];
  }
  if (state.selected !== undefined) {
    props[role === 'button' ? 'aria-pressed' : 'aria-selected'] = state.selected;
  }
  return props;
}

export function describedByIds(...values) {
  const ids = values.flatMap(value => Array.isArray(value) ? value : typeof value === 'string' ? value.split(/\s+/) : []).filter(Boolean);
  return [...new Set(ids)].join(' ') || undefined;
}
