import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import preferences from '../utils/asyncStorage';

class BiometricService {
  async checkAvailability() {
    if (Platform.OS === 'web') return { isAvailable: false, isEnrolled: false, supportedTypes: [], canUseBiometrics: false };
    try {
      const [isAvailable, isEnrolled, types] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync(),
      ]);
      const names = { 1: 'Fingerprint', 2: 'Face ID', 3: 'Iris' };
      return { isAvailable, isEnrolled, supportedTypes: types.map(type => names[type] || 'Biometric'), canUseBiometrics: isAvailable && isEnrolled };
    } catch {
      return { isAvailable: false, isEnrolled: false, supportedTypes: [], canUseBiometrics: false };
    }
  }

  async authenticate(options = {}) {
    const availability = await this.checkAvailability();
    if (!availability.canUseBiometrics) return { success: false, error: 'Device authentication is unavailable.' };
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm on this device', cancelLabel: 'Cancel', disableDeviceFallback: false, ...options,
      });
      return { success: result.success, error: result.success ? undefined : 'Device confirmation was cancelled or unsuccessful.' };
    } catch { return { success: false, error: 'Device confirmation could not be completed.' }; }
  }

  async authenticateForPayment() {
    const result = await this.authenticate();
    // A device-local result cannot be a server-verifiable payment authorization.
    return { success: false, localAuthenticationPassed: result.success, requiresServerVerification: true,
      error: result.error || 'Continue with server verification to authorize this simulated payment.' };
  }

  async isBiometricEnabled() { return await preferences.getItem('biometricEnabled') === 'true'; }
  async enableBiometric() { await preferences.setItem('biometricEnabled', 'true'); return true; }
  async disableBiometric() { await preferences.removeItem('biometricEnabled'); return true; }
  async getStatus() {
    const availability = await this.checkAvailability();
    const isEnabled = await this.isBiometricEnabled();
    return { ...availability, isEnabled, canUse: availability.canUseBiometrics && isEnabled };
  }
  async setupBiometric() {
    const result = await this.authenticate({ promptMessage: 'Enable optional device confirmation' });
    if (result.success) await this.enableBiometric();
    return result;
  }
}
export default new BiometricService();
