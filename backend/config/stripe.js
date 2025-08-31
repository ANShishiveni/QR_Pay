// Initialize Stripe with error handling
let stripe;
try {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY not found in environment variables');
  }
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  console.log('💳 Stripe initialized successfully');
} catch (error) {
  console.error('❌ Stripe initialization failed:', error.message);
  throw error;
}

// Test card numbers for different "banks" in Namibia
const TEST_CARDS = {
  'FNB': {
    number: '4242424242424242',
    cvc: '123',
    exp_month: 12,
    exp_year: 2025
  },
  'Standard Bank': {
    number: '4000056655665556',
    cvc: '123',
    exp_month: 12,
    exp_year: 2025
  },
  'Bank Windhoek': {
    number: '5555555555554444',
    cvc: '123',
    exp_month: 12,
    exp_year: 2025
  },
  'Nedbank': {
    number: '2223003122003222',
    cvc: '123',
    exp_month: 12,
    exp_year: 2025
  }
};

// Mock bank mapping for demonstration
const MOCK_BANKS = {
  '4242424242424242': 'FNB',
  '4000056655665556': 'Standard Bank',
  '5555555555554444': 'Bank Windhoek',
  '2223003122003222': 'Nedbank'
};

const createPaymentMethod = async (cardDetails) => {
  try {
    const paymentMethod = await stripe.paymentMethods.create({
      type: 'card',
      card: {
        number: cardDetails.number,
        exp_month: cardDetails.exp_month,
        exp_year: cardDetails.exp_year,
        cvc: cardDetails.cvc,
      },
    });
    
    return paymentMethod;
  } catch (error) {
    console.error('Error creating payment method:', error);
    throw error;
  }
};

const createPaymentIntent = async (amount, currency = 'NAD', paymentMethodId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      payment_method: paymentMethodId,
      confirmation_method: 'manual',
      confirm: true,
      return_url: 'https://example.com/return',
    });
    
    return paymentIntent;
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
};

const simulateCrossBankTransfer = async (senderCard, receiverCard, amount) => {
  try {
    // Create payment method for sender
    const senderPaymentMethod = await createPaymentMethod(senderCard);
    
    // Create payment intent
    const paymentIntent = await createPaymentIntent(amount, 'NAD', senderPaymentMethod.id);
    
    // Simulate cross-bank transfer
    const senderBank = MOCK_BANKS[senderCard.number] || 'Unknown Bank';
    const receiverBank = MOCK_BANKS[receiverCard.number] || 'Unknown Bank';
    
    return {
      success: true,
      paymentIntent,
      senderBank,
      receiverBank,
      amount,
      transactionId: paymentIntent.id,
      status: paymentIntent.status
    };
  } catch (error) {
    console.error('Error in cross-bank transfer:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  stripe,
  TEST_CARDS,
  MOCK_BANKS,
  createPaymentMethod,
  createPaymentIntent,
  simulateCrossBankTransfer
};