// NamPay is a simulator. These are labels for synthetic instruments, not bank
// accounts, processor tokens, or a Stripe connection. No live-money SDK is used.
const TEST_INSTRUMENTS = Object.freeze([
  Object.freeze({ id: 'demo-visa', brand: 'Visa', last4: '4242', bankLabel: 'Demo issuer A' }),
  Object.freeze({ id: 'demo-mastercard', brand: 'Mastercard', last4: '4444', bankLabel: 'Demo issuer B' }),
]);
function findTestInstrument(id) { return TEST_INSTRUMENTS.find(instrument => instrument.id === id) || null; }
function createPaymentIntent() { throw new Error('Live payments are not supported by this simulator'); }
module.exports = { TEST_INSTRUMENTS, findTestInstrument, createPaymentIntent };
