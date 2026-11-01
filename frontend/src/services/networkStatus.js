// Connectivity is a hint, never evidence that a payment succeeded or failed.
// Keep it in memory; it contains no account or request data.
let status = typeof navigator !== 'undefined' && navigator.onLine === false ? 'unreachable' : 'unknown';
const listeners = new Set();
export const getNetworkStatus = () => status;
export const isKnownOffline = () => status === 'unreachable';
export function setNetworkStatus(next) {
  if (!['unknown', 'reachable', 'unreachable'].includes(next) || next === status) return;
  status = next;
  for (const listener of listeners) listener();
}
export function subscribeNetworkStatus(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
