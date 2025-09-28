const otpService = require('../services/otpService');
const { getFirebaseServices } = require('../config/firebase');

/**
 * Middleware to verify OTP session
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const verifyOTPSession = async (req, res, next) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'OTP session ID is required'
      });
    }

    const { realtimeDb } = getFirebaseServices();
    
    // Get session data
    const sessionSnapshot = await realtimeDb.ref(`otpSessions/${sessionId}`).once('value');
    const sessionData = sessionSnapshot.val();

    if (!sessionData) {
      return res.status(404).json({
        success: false,
        error: 'Invalid OTP session'
      });
    }

    // Check if session is verified
    if (sessionData.status !== 'verified') {
      return res.status(400).json({
        success: false,
        error: 'OTP not verified'
      });
    }

    // Check if session is expired
    if (new Date(sessionData.expiresAt) < new Date()) {
      await realtimeDb.ref(`otpSessions/${sessionId}`).remove();
      return res.status(400).json({
        success: false,
        error: 'OTP session expired'
      });
    }

    // Add session data to request
    req.otpSession = sessionData;
    next();

  } catch (error) {
    console.error('OTP session verification failed:', error);
    res.status(500).json({
      success: false,
      error: 'OTP verification failed'
    });
  }
};

/**
 * Middleware to check rate limiting for OTP requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const checkOTPRateLimit = async (req, res, next) => {
  try {
    const userId = req.user.uid;

    const canSend = await otpService.canSendOTP(userId);

    if (!canSend) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Please wait before requesting another OTP.'
      });
    }

    next();

  } catch (error) {
    console.error('Rate limit check failed:', error);
    next(); // Allow on error to avoid blocking users
  }
};

/**
 * Middleware to validate phone number
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const validatePhoneNumber = (req, res, next) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({
      success: false,
      error: 'Phone number is required'
    });
  }

  // Basic phone number validation
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
    return res.status(400).json({
      success: false,
      error: 'Invalid phone number format'
    });
  }

  next();
};

/**
 * Middleware to validate OTP format
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const validateOTPFormat = (req, res, next) => {
  const { otp } = req.body;

  if (!otp) {
    return res.status(400).json({
      success: false,
      error: 'OTP is required'
    });
  }

  // OTP should be 6 digits
  const otpRegex = /^\d{6}$/;
  if (!otpRegex.test(otp)) {
    return res.status(400).json({
      success: false,
      error: 'OTP must be 6 digits'
    });
  }

  next();
};

module.exports = {
  verifyOTPSession,
  checkOTPRateLimit,
  validatePhoneNumber,
  validateOTPFormat
};
