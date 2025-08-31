const express = require('express');
const { getFirebaseServices } = require('../config/firebase');
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

// Get user profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const { realtimeDb } = getFirebaseServices();
    const userSnapshot = await realtimeDb.ref(`users/${req.user.email.replace('.', '_')}`).once('value');
    const userData = userSnapshot.val();

    if (!userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove sensitive data
    const { hashedPassword, ...safeUserData } = userData;

    res.json({
      user: safeUserData
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile', details: error.message });
  }
});

// Update user profile
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { firstName, lastName, phoneNumber } = req.body;
    const { realtimeDb } = getFirebaseServices();
    const userRef = realtimeDb.ref(`users/${req.user.email.replace('.', '_')}`);

    const updates = {};
    if (firstName) updates.firstName = firstName;
    if (lastName) updates.lastName = lastName;
    if (phoneNumber) updates.phoneNumber = phoneNumber;
    updates.updatedAt = new Date().toISOString();

    await userRef.update(updates);

    res.json({
      message: 'Profile updated successfully',
      updates
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile', details: error.message });
  }
});

// Get user's linked cards
router.get('/cards', verifyToken, async (req, res) => {
  try {
    const { realtimeDb } = getFirebaseServices();
    const userSnapshot = await realtimeDb.ref(`users/${req.user.email.replace('.', '_')}`).once('value');
    const userData = userSnapshot.val();

    if (!userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    const cards = userData.cards || {};

    // Return cards with masked numbers
    const maskedCards = Object.keys(cards).map(cardId => ({
      id: cardId,
      last4: cards[cardId].last4,
      brand: cards[cardId].brand,
      bank: cards[cardId].bank,
      isDefault: cards[cardId].isDefault || false,
      createdAt: cards[cardId].createdAt
    }));

    res.json({ cards: maskedCards });

  } catch (error) {
    console.error('Get cards error:', error);
    res.status(500).json({ error: 'Failed to get cards', details: error.message });
  }
});

// Get user's transaction history
router.get('/transactions', verifyToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    
    const { realtimeDb } = getFirebaseServices();
    const transactionsRef = realtimeDb.ref('transactions')
      .orderByChild('userId')
      .equalTo(req.user.uid)
      .limitToLast(parseInt(limit) + parseInt(offset));

    const snapshot = await transactionsRef.once('value');
    const transactions = snapshot.val() || {};

    // Convert to array and sort by timestamp
    const transactionArray = Object.keys(transactions)
      .map(id => ({ id, ...transactions[id] }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({ transactions: transactionArray });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions', details: error.message });
  }
});

// Get user statistics
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const { realtimeDb } = getFirebaseServices();
    const transactionsRef = realtimeDb.ref('transactions')
      .orderByChild('userId')
      .equalTo(req.user.uid);

    const snapshot = await transactionsRef.once('value');
    const transactions = snapshot.val() || {};

    const transactionArray = Object.values(transactions);
    
    const stats = {
      totalTransactions: transactionArray.length,
      totalSent: transactionArray
        .filter(t => t.type === 'send')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0),
      totalReceived: transactionArray
        .filter(t => t.type === 'receive')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0),
      lastTransaction: transactionArray.length > 0 
        ? transactionArray.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]
        : null
    };

    res.json({ stats });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats', details: error.message });
  }
});

module.exports = router;