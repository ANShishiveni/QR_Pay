const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { realtimeDb } = require('../config/firebase');
const { createPaymentMethod, simulateCrossBankTransfer, MOCK_BANKS } = require('../config/stripe');
const jwt = require('jsonwebtoken');

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

// Link a card to user account
router.post('/link-card', verifyToken, async (req, res) => {
  try {
    const { cardNumber, expMonth, expYear, cvc, cardholderName } = req.body;

    if (!cardNumber || !expMonth || !expYear || !cvc || !cardholderName) {
      return res.status(400).json({ error: 'All card fields are required' });
    }

    // Create payment method with Stripe
    const paymentMethod = await createPaymentMethod({
      number: cardNumber,
      exp_month: parseInt(expMonth),
      exp_year: parseInt(expYear),
      cvc: cvc
    });

    // Determine bank from card number
    const bank = MOCK_BANKS[cardNumber] || 'Unknown Bank';
    const last4 = cardNumber.slice(-4);
    const brand = cardNumber.startsWith('4') ? 'Visa' : 
                  cardNumber.startsWith('5') ? 'Mastercard' : 'Unknown';

    // Store card information in Firebase
    const cardId = uuidv4();
    const cardData = {
      id: cardId,
      paymentMethodId: paymentMethod.id,
      last4: last4,
      brand: brand,
      bank: bank,
      cardholderName: cardholderName,
      isDefault: false,
      createdAt: new Date().toISOString()
    };

    const userRef = realtimeDb.ref(`users/${req.user.email.replace('.', '_')}/cards/${cardId}`);
    await userRef.set(cardData);

    res.json({
      message: 'Card linked successfully',
      card: {
        id: cardId,
        last4: last4,
        brand: brand,
        bank: bank,
        cardholderName: cardholderName
      }
    });

  } catch (error) {
    console.error('Link card error:', error);
    res.status(500).json({ error: 'Failed to link card', details: error.message });
  }
});

// Set default card
router.put('/set-default-card/:cardId', verifyToken, async (req, res) => {
  try {
    const { cardId } = req.params;
    const userRef = realtimeDb.ref(`users/${req.user.email.replace('.', '_')}/cards`);

    // Get all user cards
    const cardsSnapshot = await userRef.once('value');
    const cards = cardsSnapshot.val() || {};

    if (!cards[cardId]) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // Reset all cards to not default
    const updates = {};
    Object.keys(cards).forEach(id => {
      updates[`${id}/isDefault`] = false;
    });

    // Set selected card as default
    updates[`${cardId}/isDefault`] = true;

    await userRef.update(updates);

    res.json({ message: 'Default card updated successfully' });

  } catch (error) {
    console.error('Set default card error:', error);
    res.status(500).json({ error: 'Failed to set default card', details: error.message });
  }
});

// Remove linked card
router.delete('/remove-card/:cardId', verifyToken, async (req, res) => {
  try {
    const { cardId } = req.params;
    const cardRef = realtimeDb.ref(`users/${req.user.email.replace('.', '_')}/cards/${cardId}`);

    const cardSnapshot = await cardRef.once('value');
    if (!cardSnapshot.exists()) {
      return res.status(404).json({ error: 'Card not found' });
    }

    await cardRef.remove();

    res.json({ message: 'Card removed successfully' });

  } catch (error) {
    console.error('Remove card error:', error);
    res.status(500).json({ error: 'Failed to remove card', details: error.message });
  }
});

// Process payment between users
router.post('/process-payment', verifyToken, async (req, res) => {
  try {
    const { receiverEmail, amount, description, senderCardId } = req.body;

    if (!receiverEmail || !amount || !senderCardId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const paymentAmount = parseFloat(amount);
    if (paymentAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    // Get sender's card information
    const senderCardRef = realtimeDb.ref(`users/${req.user.email.replace('.', '_')}/cards/${senderCardId}`);
    const senderCardSnapshot = await senderCardRef.once('value');
    const senderCardData = senderCardSnapshot.val();

    if (!senderCardData) {
      return res.status(404).json({ error: 'Sender card not found' });
    }

    // Get receiver information
    const receiverSnapshot = await realtimeDb.ref(`users/${receiverEmail.replace('.', '_')}`).once('value');
    const receiverData = receiverSnapshot.val();

    if (!receiverData) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    // Get receiver's default card
    const receiverCards = receiverData.cards || {};
    const defaultCardId = Object.keys(receiverCards).find(id => receiverCards[id].isDefault);
    
    if (!defaultCardId) {
      return res.status(400).json({ error: 'Receiver has no default card set' });
    }

    const receiverCardData = receiverCards[defaultCardId];

    // Simulate cross-bank transfer
    const transferResult = await simulateCrossBankTransfer(
      { number: senderCardData.paymentMethodId }, // Using payment method ID for simulation
      { number: receiverCardData.paymentMethodId },
      paymentAmount
    );

    if (!transferResult.success) {
      return res.status(400).json({ error: 'Payment failed', details: transferResult.error });
    }

    // Create transaction records
    const transactionId = uuidv4();
    const timestamp = new Date().toISOString();

    // Sender transaction
    const senderTransaction = {
      id: transactionId,
      userId: req.user.uid,
      type: 'send',
      amount: paymentAmount,
      currency: 'NAD',
      receiverEmail: receiverEmail,
      receiverName: `${receiverData.firstName} ${receiverData.lastName}`,
      description: description || 'QR Payment',
      status: 'completed',
      timestamp: timestamp,
      senderBank: transferResult.senderBank,
      receiverBank: transferResult.receiverBank
    };

    // Receiver transaction
    const receiverTransaction = {
      id: transactionId,
      userId: receiverData.uid,
      type: 'receive',
      amount: paymentAmount,
      currency: 'NAD',
      senderEmail: req.user.email,
      senderName: `${req.user.firstName} ${req.user.lastName}`,
      description: description || 'QR Payment',
      status: 'completed',
      timestamp: timestamp,
      senderBank: transferResult.senderBank,
      receiverBank: transferResult.receiverBank
    };

    // Save transactions to Firebase
    await realtimeDb.ref(`transactions/${transactionId}`).set(senderTransaction);
    await realtimeDb.ref(`transactions/${transactionId}_receiver`).set(receiverTransaction);

    res.json({
      message: 'Payment processed successfully',
      transaction: {
        id: transactionId,
        amount: paymentAmount,
        currency: 'NAD',
        receiverName: `${receiverData.firstName} ${receiverData.lastName}`,
        senderBank: transferResult.senderBank,
        receiverBank: transferResult.receiverBank,
        timestamp: timestamp,
        status: 'completed'
      }
    });

  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({ error: 'Payment processing failed', details: error.message });
  }
});

// Get payment history
router.get('/history', verifyToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0, type } = req.query;
    
    let query = realtimeDb.ref('transactions')
      .orderByChild('userId')
      .equalTo(req.user.uid);

    if (type && (type === 'send' || type === 'receive')) {
      // Note: Firebase doesn't support multiple orderByChild filters
      // This is a simplified implementation
    }

    const snapshot = await query.limitToLast(parseInt(limit) + parseInt(offset)).once('value');
    const transactions = snapshot.val() || {};

    // Convert to array and sort by timestamp
    const transactionArray = Object.keys(transactions)
      .map(id => ({ id, ...transactions[id] }))
      .filter(t => !type || t.type === type)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({ transactions: transactionArray });

  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({ error: 'Failed to get payment history', details: error.message });
  }
});

module.exports = router;