// Payment authorization is consumed only inside the atomic payment transaction.
// A middleware pre-check cannot authorize a later independent database write.
const { requireId, httpError } = require('../utils/paymentValidation');
function verifyOTPSession(req, res, next) {
  try { requireId(req.body?.sessionId, 'Verification session ID'); return next(); }
  catch (error) { return next(error); }
}
function validateOTPFormat(req, res, next) {
  if (typeof req.body?.otp !== 'string' || !/^\d{6}$/.test(req.body.otp)) {
    return next(httpError(400, 'OTP_INPUT_INVALID', 'Enter the six-digit verification code'));
  }
  return next();
}
module.exports = { verifyOTPSession, validateOTPFormat };
