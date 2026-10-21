import preferences from '../utils/asyncStorage';
import biometricService from './biometricService';
import { otpAPI } from '../config/api';

const defaults = () => ({ primaryMethod: 'otp', biometricEnabled: false });
class MFAService {
  constructor() { this.preferences = defaults(); }
  async initialize() {
    await this.loadPreferences();
    return { success: true, preferences: this.preferences, biometricAvailable: (await biometricService.getStatus()).canUse };
  }
  async loadPreferences() {
    this.preferences = defaults();
    try {
      const saved = JSON.parse(await preferences.getItem('mfaPreferences') || '{}');
      this.preferences.biometricEnabled = saved.biometricEnabled === true;
      this.preferences.primaryMethod = saved.primaryMethod === 'biometric' ? 'biometric' : 'otp';
    } catch { /* Invalid preferences revert to server verification. */ }
  }
  async updatePreferences(next) {
    this.preferences = { primaryMethod: next.primaryMethod === 'biometric' ? 'biometric' : 'otp',
      biometricEnabled: next.biometricEnabled ?? this.preferences.biometricEnabled };
    await preferences.setItem('mfaPreferences', JSON.stringify(this.preferences));
    return true;
  }
  async getAvailableMethods() {
    return [{ id: 'otp', name: 'Server verification', description: 'A request-bound code from the configured sandbox provider', enabled: true, available: true }];
  }
  async authenticate({ requestId, purpose = 'payment_verification', preferredMethod } = {}) {
    if (!requestId) return { success: false, error: 'A current payment request is required.' };
    if ((preferredMethod || this.preferences.primaryMethod) === 'biometric') {
      const local = await biometricService.authenticate();
      if (!local.success) return { ...local, fallbackAvailable: true };
    }
    return this.authenticateWithSMS(requestId, purpose);
  }
  async authenticateWithBiometric(requestId) {
    return this.authenticate({ requestId, preferredMethod: 'biometric' });
  }
  async authenticateWithSMS(requestId, purpose = 'payment_verification') {
    try {
      const { data } = await otpAPI.sendOTP(requestId, purpose);
      return { success: data.success === true, method: 'otp', sessionId: data.sessionId,
        requiresVerification: true, expiresAt: data.expiresAt, provider: data.provider, maskedDestination: data.maskedDestination };
    } catch (error) { return { success: false, error: error.message }; }
  }
  async verifyOTP(sessionId, otp) {
    try { const { data } = await otpAPI.verifyOTP(sessionId, otp); return { success: data.success === true, verified: data.success === true }; }
    catch (error) { return { success: false, error: error.message, attemptsLeft: error.response?.data?.attemptsLeft }; }
  }
  async getStatus() {
    await this.loadPreferences();
    return { success: true, preferences: this.preferences, availableMethods: await this.getAvailableMethods(),
      biometricAvailable: (await biometricService.getStatus()).canUse, isConfigured: true };
  }
  async setupMFA({ enableBiometric = false } = {}) {
    if (enableBiometric) {
      const result = await biometricService.setupBiometric();
      if (!result.success) return result;
    }
    await this.updatePreferences({ biometricEnabled: enableBiometric, primaryMethod: enableBiometric ? 'biometric' : 'otp' });
    return { success: true, message: 'Device preference saved. Server verification is still required.' };
  }
}
export default new MFAService();
