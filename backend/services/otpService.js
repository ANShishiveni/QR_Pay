const crypto = require('crypto');
const { getFirebaseServices } = require('../config/firebase');
const twilioService = require('./twilioService');

class OTPService {
  constructor() {
    this.otpLength = 6;
    this.otpExpiryMinutes = 5;
    this.maxAttempts = 3;
    this.rateLimitMinutes = 1;
  }

  /**
   * Generate a secure 6-digit OTP
   * @returns {string} - 6-digit OTP
   */
  generateOTP() {
    // Generate cryptographically secure random number
    const randomBytes = crypto.randomBytes(4);
    const randomNumber = randomBytes.readUInt32BE(0);
    
    // Convert to 6-digit string with leading zeros
    const otp = (randomNumber % 1000000).toString().padStart(6, '0');
    
    return otp;
  }

  /**
   * Hash OTP for secure storage
   * @param {string} otp - Plain text OTP
   * @returns {string} - Hashed OTP
   */
  hashOTP(otp) {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  /**
   * Verify OTP against hash
   * @param {string} otp - Plain text OTP
   * @param {string} hash - Hashed OTP
   * @returns {boolean} - Is valid OTP
   */
  verifyOTP(otp, hash) {
    const hashedOTP = this.hashOTP(otp);
    return hashedOTP === hash;
  }

  /**
   * Create OTP session
   * @param {string} userId - User ID
   * @param {string} phoneNumber - User's phone number
   * @param {string} purpose - Purpose of OTP
   * @returns {Promise<Object>} - OTP session data
   */
  async createOTPSession(userId, phoneNumber, purpose = 'verification') {
    try {
      const { realtimeDb } = getFirebaseServices();
      
      // Generate OTP and session ID
      const otp = this.generateOTP();
      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + this.otpExpiryMinutes * 60 * 1000);
      
      // Create session data
      const sessionData = {
        userId,
        phoneNumber: twilioService.formatPhoneNumber(phoneNumber),
        otpHash: this.hashOTP(otp),
        expiresAt: expiresAt.toISOString(),
        attempts: 0,
        maxAttempts: this.maxAttempts,
        status: 'pending',
        purpose,
        createdAt: new Date().toISOString()
      };

      // Store session in Firebase
      await realtimeDb.ref(`otpSessions/${sessionId}`).set(sessionData);

      // Send OTP via SMS
      const smsResult = await twilioService.sendOTP(
        sessionData.phoneNumber,
        otp,
        purpose
      );

      if (!smsResult.success) {
        // Clean up session if SMS fails
        await realtimeDb.ref(`otpSessions/${sessionId}`).remove();
        throw new Error(`SMS delivery failed: ${smsResult.error}`);
      }

      return {
        success: true,
        sessionId,
        expiresAt: sessionData.expiresAt,
        messageId: smsResult.messageId
      };

    } catch (error) {
      console.error('OTP session creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verify OTP
   * @param {string} sessionId - OTP session ID
   * @param {string} otp - User-entered OTP
   * @returns {Promise<Object>} - Verification result
   */
  async verifyOTP(sessionId, otp) {
    try {
      const { realtimeDb } = getFirebaseServices();
      
      // Get session data
      const sessionSnapshot = await realtimeDb.ref(`otpSessions/${sessionId}`).once('value');
      const sessionData = sessionSnapshot.val();

      if (!sessionData) {
        return {
          success: false,
          error: 'Invalid session ID'
        };
      }

      // Check if session is expired
      if (new Date(sessionData.expiresAt) < new Date()) {
        await realtimeDb.ref(`otpSessions/${sessionId}`).remove();
        return {
          success: false,
          error: 'OTP has expired'
        };
      }

      // Check if session is already verified
      if (sessionData.status === 'verified') {
        return {
          success: false,
          error: 'OTP already verified'
        };
      }

      // Check attempt limit
      if (sessionData.attempts >= sessionData.maxAttempts) {
        await realtimeDb.ref(`otpSessions/${sessionId}`).update({
          status: 'blocked'
        });
        return {
          success: false,
          error: 'Maximum attempts exceeded'
        };
      }

      // Increment attempts
      await realtimeDb.ref(`otpSessions/${sessionId}`).update({
        attempts: sessionData.attempts + 1
      });

      // Verify OTP
      const isValid = this.verifyOTP(otp, sessionData.otpHash);

      if (isValid) {
        // Mark as verified
        await realtimeDb.ref(`otpSessions/${sessionId}`).update({
          status: 'verified',
          verifiedAt: new Date().toISOString()
        });

        return {
          success: true,
          userId: sessionData.userId,
          phoneNumber: sessionData.phoneNumber
        };
      } else {
        return {
          success: false,
          error: 'Invalid OTP',
          attemptsLeft: sessionData.maxAttempts - (sessionData.attempts + 1)
        };
      }

    } catch (error) {
      console.error('OTP verification failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check rate limiting
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - Can send OTP
   */
  async canSendOTP(userId) {
    try {
      const { realtimeDb } = getFirebaseServices();
      
      // Check for recent OTP sessions
      const sessionsSnapshot = await realtimeDb.ref('otpSessions')
        .orderByChild('userId')
        .equalTo(userId)
        .once('value');

      const sessions = sessionsSnapshot.val() || {};
      const now = new Date();
      const rateLimitTime = new Date(now.getTime() - this.rateLimitMinutes * 60 * 1000);

      // Check if any recent sessions exist
      for (const [sessionId, sessionData] of Object.entries(sessions)) {
        const createdAt = new Date(sessionData.createdAt);
        if (createdAt > rateLimitTime && sessionData.status === 'pending') {
          return false;
        }
      }

      return true;

    } catch (error) {
      console.error('Rate limit check failed:', error);
      return true; // Allow on error to avoid blocking users
    }
  }

  /**
   * Clean up expired sessions
   * @returns {Promise<void>}
   */
  async cleanupExpiredSessions() {
    try {
      const { realtimeDb } = getFirebaseServices();
      
      const sessionsSnapshot = await realtimeDb.ref('otpSessions').once('value');
      const sessions = sessionsSnapshot.val() || {};
      const now = new Date();

      const cleanupPromises = [];

      for (const [sessionId, sessionData] of Object.entries(sessions)) {
        if (new Date(sessionData.expiresAt) < now) {
          cleanupPromises.push(
            realtimeDb.ref(`otpSessions/${sessionId}`).remove()
          );
        }
      }

      await Promise.all(cleanupPromises);
      console.log(`Cleaned up ${cleanupPromises.length} expired OTP sessions`);

    } catch (error) {
      console.error('OTP cleanup failed:', error);
    }
  }
}

module.exports = new OTPService();
