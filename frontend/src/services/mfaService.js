import AsyncStorage from '../utils/asyncStorage';
import biometricService from './biometricService';
import { otpAPI } from '../config/api';

class MFAService {
  constructor() {
    this.preferences = {
      primaryMethod: 'sms',
      secondaryMethod: 'sms',
      biometricEnabled: false,
      smsEnabled: true,
    };
  }

  /**
   * Initialize MFA service
   * @returns {Promise<Object>} - Initialization result
   */
  async initialize() {
    try {
      // Load user preferences
      await this.loadPreferences();
      
      // Check biometric availability
      const biometricStatus = await biometricService.getStatus();
      
      return {
        success: true,
        preferences: this.preferences,
        biometricAvailable: biometricStatus.canUse,
      };
    } catch (error) {
      console.error('MFA initialization failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Load user MFA preferences
   * @returns {Promise<void>}
   */
  async loadPreferences() {
    try {
      const stored = await AsyncStorage.getItem('mfaPreferences');
      if (stored) {
        this.preferences = { ...this.preferences, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Failed to load MFA preferences:', error);
    }
  }

  /**
   * Save user MFA preferences
   * @returns {Promise<boolean>} - Success status
   */
  async savePreferences() {
    try {
      await AsyncStorage.setItem('mfaPreferences', JSON.stringify(this.preferences));
      return true;
    } catch (error) {
      console.error('Failed to save MFA preferences:', error);
      return false;
    }
  }

  /**
   * Update MFA preferences
   * @param {Object} newPreferences - New preferences
   * @returns {Promise<boolean>} - Success status
   */
  async updatePreferences(newPreferences) {
    try {
      this.preferences = { ...this.preferences, ...newPreferences };
      return await this.savePreferences();
    } catch (error) {
      console.error('Failed to update MFA preferences:', error);
      return false;
    }
  }

  /**
   * Get available authentication methods
   * @returns {Promise<Array>} - Available methods
   */
  async getAvailableMethods() {
    const methods = [];
    
    // Check biometric availability
    const biometricStatus = await biometricService.getStatus();
    if (biometricStatus.canUse) {
      methods.push({
        id: 'biometric',
        name: 'Biometric Authentication',
        description: 'Use fingerprint or face recognition',
        available: true,
        enabled: this.preferences.biometricEnabled,
      });
    }

    // SMS is always available
    methods.push({
      id: 'sms',
      name: 'SMS OTP',
      description: 'Receive OTP via SMS',
      available: true,
      enabled: this.preferences.smsEnabled,
    });

    return methods;
  }

  /**
   * Authenticate using MFA
   * @param {Object} options - Authentication options
   * @returns {Promise<Object>} - Authentication result
   */
  async authenticate(options = {}) {
    const { 
      amount, 
      recipient, 
      purpose = 'payment_verification',
      phoneNumber,
      preferredMethod = null 
    } = options;

    try {
      // Determine authentication method
      const method = preferredMethod || this.preferences.primaryMethod;
      
      switch (method) {
        case 'biometric':
          return await this.authenticateWithBiometric(amount, recipient);
        
        case 'sms':
          return await this.authenticateWithSMS(phoneNumber, purpose);
        
        default:
          // Fallback to SMS
          return await this.authenticateWithSMS(phoneNumber, purpose);
      }
    } catch (error) {
      console.error('MFA authentication failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Authenticate with biometric
   * @param {string} amount - Payment amount
   * @param {string} recipient - Payment recipient
   * @returns {Promise<Object>} - Authentication result
   */
  async authenticateWithBiometric(amount, recipient) {
    try {
      const result = await biometricService.authenticateForPayment(amount, recipient);
      
      if (result.success) {
        return {
          success: true,
          method: 'biometric',
          sessionId: 'biometric_verified',
        };
      } else {
        return {
          success: false,
          error: result.error,
          fallbackAvailable: true,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        fallbackAvailable: true,
      };
    }
  }

  /**
   * Authenticate with SMS OTP
   * @param {string} phoneNumber - User's phone number
   * @param {string} purpose - OTP purpose
   * @returns {Promise<Object>} - Authentication result
   */
  async authenticateWithSMS(phoneNumber, purpose) {
    try {
      // Send OTP
      const sendResult = await otpAPI.sendOTP(phoneNumber, purpose);
      
      if (sendResult.data.success) {
        return {
          success: true,
          method: 'sms',
          sessionId: sendResult.data.sessionId,
          requiresVerification: true,
          expiresAt: sendResult.data.expiresAt,
        };
      } else {
        return {
          success: false,
          error: sendResult.data.error,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verify OTP
   * @param {string} sessionId - OTP session ID
   * @param {string} otp - OTP code
   * @returns {Promise<Object>} - Verification result
   */
  async verifyOTP(sessionId, otp) {
    try {
      const result = await otpAPI.verifyOTP(sessionId, otp);
      
      if (result.data.success) {
        return {
          success: true,
          verified: true,
        };
      } else {
        return {
          success: false,
          error: result.data.error,
          attemptsLeft: result.data.attemptsLeft,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get MFA status
   * @returns {Promise<Object>} - MFA status
   */
  async getStatus() {
    try {
      const availableMethods = await this.getAvailableMethods();
      const biometricStatus = await biometricService.getStatus();
      
      return {
        success: true,
        preferences: this.preferences,
        availableMethods: availableMethods,
        biometricAvailable: biometricStatus.canUse,
        isConfigured: availableMethods.some(method => method.enabled),
      };
    } catch (error) {
      console.error('Failed to get MFA status:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Setup MFA for user
   * @param {Object} setupOptions - Setup options
   * @returns {Promise<Object>} - Setup result
   */
  async setupMFA(setupOptions = {}) {
    try {
      const { 
        enableBiometric = false, 
        enableSMS = true, 
        primaryMethod = 'sms'
      } = setupOptions;

      // Update preferences
      await this.updatePreferences({
        biometricEnabled: enableBiometric,
        smsEnabled: enableSMS,
        primaryMethod: primaryMethod,
      });

      // Setup biometric if enabled
      if (enableBiometric) {
        const biometricSetup = await biometricService.setupBiometric();
        if (!biometricSetup.success) {
          console.warn('Biometric setup failed:', biometricSetup.error);
        }
      }

      return {
        success: true,
        message: 'MFA setup completed successfully',
      };
    } catch (error) {
      console.error('MFA setup failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export default new MFAService();
