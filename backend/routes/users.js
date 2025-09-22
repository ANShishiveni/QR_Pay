const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { getFirebaseServices } = require('../config/firebase');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Configure multer for photo uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

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

// Upload user photo
router.post('/photo', verifyToken, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }

    const { realtimeDb } = getFirebaseServices();
    
    // For development, we'll use a simple base64 approach
    // Convert the image buffer to base64
    const base64Image = req.file.buffer.toString('base64');
    const dataUrl = `data:${req.file.mimetype};base64,${base64Image}`;
    
    // Update user profile with base64 photo data
    const userRef = realtimeDb.ref(`users/${req.user.email.replace('.', '_')}`);
    await userRef.update({
      photoUrl: dataUrl,
      updatedAt: new Date().toISOString()
    });

    res.json({
      message: 'Photo uploaded successfully',
      photoUrl: dataUrl
    });

  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ error: 'Failed to upload photo', details: error.message });
  }
});

// Change user password
router.put('/password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    const { realtimeDb } = getFirebaseServices();
    const userRef = realtimeDb.ref(`users/${req.user.email.replace('.', '_')}`);
    const userSnapshot = await userRef.once('value');
    const userData = userSnapshot.val();

    if (!userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userData.hashedPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await userRef.update({
      hashedPassword: hashedNewPassword,
      updatedAt: new Date().toISOString()
    });

    res.json({
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Failed to change password', details: error.message });
  }
});

module.exports = router;