import * as SecureStore from 'expo-secure-store';
import { createTokenStore } from './tokenStore';

export default createTokenStore(SecureStore, {
  options: { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
});
