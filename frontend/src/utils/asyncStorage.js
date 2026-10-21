import NativePreferences from '@react-native-async-storage/async-storage';
import { createPreferenceStore } from '../services/storage/preferenceStore';

// Tokens never pass through this adapter. Personal profile caches are memory-only.
const preferences = createPreferenceStore(NativePreferences);
export default preferences;
export const setPreferenceUser = (uid) => preferences.setUser(uid);
export const clearSessionCache = () => preferences.clearMemory();
export const useAsyncStorage = (key) => ({
  getItem: () => preferences.getItem(key),
  setItem: (value) => preferences.setItem(key, value),
  removeItem: () => preferences.removeItem(key),
});
