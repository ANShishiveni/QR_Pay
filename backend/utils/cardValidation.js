const { findTestInstrument } = require('../config/stripe');
const { httpError, textField } = require('./paymentValidation');

function validateExpiryDate(month, year, now = Date.now()) {
  const date = new Date(now);
  const valid = Number.isInteger(month) && month >= 1 && month <= 12 && Number.isInteger(year)
    && year <= date.getUTCFullYear() + 10
    && (year > date.getUTCFullYear() || (year === date.getUTCFullYear() && month >= date.getUTCMonth() + 1));
  return { isValid: valid, error: valid ? null : 'Test instrument expiry is invalid or expired' };
}
function validateTestCard(body, now = Date.now()) {
  if (['cardNumber', 'number', 'pan', 'cvc', 'cvv'].some(key => Object.hasOwn(body, key))) {
    throw httpError(400, 'TEST_CARD_REQUIRED', 'Choose a predefined test instrument. Do not enter a real card number or security code');
  }
  const instrument = findTestInstrument(body.testCardId);
  if (!instrument) throw httpError(400, 'TEST_CARD_REQUIRED', 'Choose one of the available test instruments');
  const expMonth = body.expMonth === undefined ? 12 : Number(body.expMonth);
  const expYear = body.expYear === undefined ? new Date(now).getUTCFullYear() + 3 : Number(body.expYear);
  if (!validateExpiryDate(expMonth, expYear, now).isValid) throw httpError(400, 'CARD_EXPIRED', 'Test instrument expiry is invalid or expired');
  return { instrument, expMonth, expYear, cardholderName: textField(body.cardholderName, 'Cardholder name', 80, '') };
}
function isUsableTestCard(card, now = Date.now()) {
  return Boolean(card && findTestInstrument(card.testCardId) && card.simulated === true
    && validateExpiryDate(card.expMonth, card.expYear, now).isValid);
}
module.exports = { validateTestCard, validateExpiryDate, isUsableTestCard };
