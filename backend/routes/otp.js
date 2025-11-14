const express = require('express');
const otpService = require('../services/otpService');
const jwt = require('jsonwebtoken');
const { 
  checkOTPRateLimit, 
  validatePhoneNumber, 
  validateOTPFormat 
} = require('../middleware/otpAuth');

const router = express.Router();

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Send OTP to user's phone number
 * POST /api/otp/send
 */
router.post('/send', verifyToken, checkOTPRateLimit, validatePhoneNumber, async (req, res) => {
  try {
    const { phoneNumber, purpose = 'payment_verification' } = req.body;
    const userId = req.user.uid;

    // Create OTP session and send SMS
    const result = await otpService.createOTPSession(userId, phoneNumber, purpose);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'OTP sent successfully',
      sessionId: result.sessionId,
      expiresAt: result.expiresAt
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send OTP'
    });
  }
});

/**
 * Verify OTP
 * POST /api/otp/verify
 */
router.post('/verify', verifyToken, validateOTPFormat, async (req, res) => {
  try {
    const { sessionId, otp } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }

    // Verify OTP
    const result = await otpService.verifyOTP(sessionId, otp);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        attemptsLeft: result.attemptsLeft
      });
    }

    res.json({
      success: true,
      message: 'OTP verified successfully',
      userId: result.userId,
      phoneNumber: result.phoneNumber
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify OTP'
    });
  }
});

/**
 * Resend OTP
 * POST /api/otp/resend
 */
router.post('/resend', verifyToken, checkOTPRateLimit, validatePhoneNumber, async (req, res) => {
  try {
    const { phoneNumber, purpose = 'payment_verification' } = req.body;
    const userId = req.user.uid;

    // Create new OTP session
    const result = await otpService.createOTPSession(userId, phoneNumber, purpose);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'OTP resent successfully',
      sessionId: result.sessionId,
      expiresAt: result.expiresAt
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resend OTP'
    });
  }
});

/**
 * Get OTP session status
 * GET /api/otp/status/:sessionId
 */
router.get('/status/:sessionId', verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { realtimeDb } = require('../config/firebase').getFirebaseServices();

    // Get session data
    const sessionSnapshot = await realtimeDb.ref(`otpSessions/${sessionId}`).once('value');
    const sessionData = sessionSnapshot.val();

    if (!sessionData) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Check if session belongs to user
    if (sessionData.userId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const now = new Date();
    const isExpired = new Date(sessionData.expiresAt) < now;

    res.json({
      success: true,
      session: {
        id: sessionId,
        status: sessionData.status,
        attempts: sessionData.attempts,
        maxAttempts: sessionData.maxAttempts,
        expiresAt: sessionData.expiresAt,
        isExpired,
        purpose: sessionData.purpose
      }
    });

  } catch (error) {
    console.error('Get OTP status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get OTP status'
    });
  }
});

/**
 * Cleanup expired OTP sessions (admin endpoint)
 * POST /api/otp/cleanup
 */
router.post('/cleanup', verifyToken, async (req, res) => {
  try {
    // Only allow admin users to cleanup
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await otpService.cleanupExpiredSessions();

    res.json({
      success: true,
      message: 'Expired OTP sessions cleaned up'
    });

  } catch (error) {
    console.error('Cleanup OTP error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup OTP sessions'
    });
  }
});

module.exports = router;
