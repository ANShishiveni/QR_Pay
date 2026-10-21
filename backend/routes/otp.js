const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { getOtpService } = require('../services/otpService');
const { validateOTPFormat } = require('../middleware/otpAuth');
const { httpError, route } = require('../utils/paymentValidation');
const router = express.Router();
router.use(verifyToken);
const issue = route(async (req, res) => {
  if (!req.body || Object.keys(req.body).some(key => !['requestId', 'purpose'].includes(key))) {
    throw httpError(400, 'OTP_REQUEST_INVALID', 'The verification destination is determined by your account');
  }
  res.json(await getOtpService(req.app).issue({
    userUid: req.user.uid, requestId: req.body.requestId, purpose: req.body.purpose, ip: req.ip,
  }));
});
router.post('/send', issue);
router.post('/resend', issue);
router.post('/verify', validateOTPFormat, route(async (req, res) => {
  if (!req.body || Object.keys(req.body).some(key => !['sessionId', 'otp'].includes(key))) {
    throw httpError(400, 'OTP_INPUT_INVALID', 'The verification request is invalid');
  }
  try {
    res.json(await getOtpService(req.app).verify({ userUid: req.user.uid, sessionId: req.body.sessionId, otp: req.body.otp }));
  } catch (error) {
    if (error.code === 'OTP_INVALID') return res.status(error.status).json({
      success: false, code: error.code, error: error.message, attemptsLeft: error.attemptsLeft, requestId: req.id,
    });
    throw error;
  }
}));
router.get('/status/:sessionId', route(async (req, res) => {
  res.json(await getOtpService(req.app).status({ userUid: req.user.uid, sessionId: req.params.sessionId }));
}));
module.exports = router;
