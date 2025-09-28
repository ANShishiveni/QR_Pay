import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '../utils/asyncStorage';

class BiometricService {
  constructor() {
    this.isAvailable = false;
    this.isEnrolled = false;
    this.supportedTypes = [];
  }

  /**
   * Check if biometric authentication is available on the device
   * @returns {Promise<Object>} - Availability status and supported types
   */
  async checkAvailability() {
    try {
      console.log('Checking biometric availability...');
      
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      console.log('Has hardware:', hasHardware);
      
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      console.log('Is enrolled:', isEnrolled);
      
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      console.log('Supported types:', supportedTypes);

      this.isAvailable = hasHardware;
      this.isEnrolled = isEnrolled;
      this.supportedTypes = supportedTypes;

      const result = {
        isAvailable: hasHardware,
        isEnrolled: isEnrolled,
        supportedTypes: supportedTypes,
        canUseBiometrics: hasHardware && isEnrolled
      };
      
      console.log('Biometric availability result:', result);
      return result;
    } catch (error) {
      console.error('Biometric availability check failed:', error);
      return {
        isAvailable: false,
        isEnrolled: false,
        supportedTypes: [],
        canUseBiometrics: false,
        error: error.message
      };
    }
  }

  /**
   * Get supported biometric types as readable strings
   * @returns {Array<string>} - Array of supported biometric types
   */
  getSupportedTypes() {
    const typeMap = {
      [LocalAuthentication.AuthenticationType.FINGERPRINT]: 'Fingerprint',
      [LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION]: 'Face ID',
      [LocalAuthentication.AuthenticationType.IRIS]: 'Iris',
    };

    return this.supportedTypes.map(type => typeMap[type] || 'Unknown');
  }

  /**
   * Authenticate using biometrics
   * @param {Object} options - Authentication options
   * @returns {Promise<Object>} - Authentication result
   */
  async authenticate(options = {}) {
    try {
      const defaultOptions = {
        promptMessage: 'Verify your identity to continue',
        fallbackLabel: 'Use PIN instead',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel',
        ...options
      };

      const result = await LocalAuthentication.authenticateAsync(defaultOptions);

      return {
        success: result.success,
        error: result.error,
        warning: result.warning
      };
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Authenticate for payment
   * @param {string} amount - Payment amount
   * @param {string} recipient - Payment recipient
   * @returns {Promise<Object>} - Authentication result
   */
  async authenticateForPayment(amount, recipient) {
    const options = {
      promptMessage: `Verify your identity to send N$ ${amount} to ${recipient}`,
      fallbackLabel: 'Use OTP instead',
      disableDeviceFallback: false
    };

    return await this.authenticate(options);
  }

  /**
   * Check if user has enabled biometric authentication
   * @returns {Promise<boolean>} - Is biometric enabled
   */
  async isBiometricEnabled() {
    try {
      const enabled = await AsyncStorage.getItem('biometricEnabled');
      return enabled === 'true';
    } catch (error) {
      console.error('Failed to check biometric setting:', error);
      return false;
    }
  }

  /**
   * Enable biometric authentication
   * @returns {Promise<boolean>} - Success status
   */
  async enableBiometric() {
    try {
      await AsyncStorage.setItem('biometricEnabled', 'true');
      return true;
    } catch (error) {
      console.error('Failed to enable biometric:', error);
      return false;
    }
  }

  /**
   * Disable biometric authentication
   * @returns {Promise<boolean>} - Success status
   */
  async disableBiometric() {
    try {
      await AsyncStorage.removeItem('biometricEnabled');
      return true;
    } catch (error) {
      console.error('Failed to disable biometric:', error);
      return false;
    }
  }

  /**
   * Get biometric authentication status
   * @returns {Promise<Object>} - Complete biometric status
   */
  async getStatus() {
    const availability = await this.checkAvailability();
    const isEnabled = await this.isBiometricEnabled();

    return {
      ...availability,
      isEnabled: isEnabled,
      canUse: availability.canUseBiometrics && isEnabled
    };
  }

  /**
   * Setup biometric authentication for user
   * @returns {Promise<Object>} - Setup result
   */
  async setupBiometric() {
    try {
      const availability = await this.checkAvailability();

      if (!availability.canUseBiometrics) {
        return {
          success: false,
          error: 'Biometric authentication is not available on this device'
        };
      }

      // Test authentication
      const authResult = await this.authenticate({
        promptMessage: 'Set up biometric authentication for secure payments',
        fallbackLabel: 'Skip for now'
      });

      if (authResult.success) {
        await this.enableBiometric();
        return {
          success: true,
          message: 'Biometric authentication enabled successfully'
        };
      } else {
        return {
          success: false,
          error: authResult.error || 'Biometric setup failed'
        };
      }
    } catch (error) {
      console.error('Biometric setup failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new BiometricService();
