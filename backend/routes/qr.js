const express = require('express');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
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

// Generate QR code for payment request
router.post('/generate', verifyToken, async (req, res) => {
  try {
    const { amount, description, expiresIn = 300 } = req.body; // expiresIn in seconds, default 5 minutes
    const { realtimeDb } = getFirebaseServices();

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const paymentAmount = parseFloat(amount);
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Create payment request data
    const paymentRequest = {
      id: uuidv4(),
      senderId: req.user.uid,
      senderEmail: req.user.email,
      senderName: `${req.user.firstName} ${req.user.lastName}`,
      amount: paymentAmount,
      currency: 'NAD',
      description: description || 'QR Payment Request',
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt
    };

    // Store payment request in Firebase
    await realtimeDb.ref(`paymentRequests/${paymentRequest.id}`).set(paymentRequest);

    // Create QR code data
    const qrData = {
      type: 'payment_request',
      requestId: paymentRequest.id,
      amount: paymentAmount,
      currency: 'NAD',
      senderName: paymentRequest.senderName,
      description: paymentRequest.description,
      expiresAt: expiresAt
    };

    // Generate QR code
    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    res.json({
      message: 'QR code generated successfully',
      qrCode: qrCodeDataURL,
      paymentRequest: {
        id: paymentRequest.id,
        amount: paymentAmount,
        currency: 'NAD',
        description: paymentRequest.description,
        expiresAt: expiresAt,
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('Generate QR code error:', error);
    res.status(500).json({ error: 'Failed to generate QR code', details: error.message });
  }
});

// Scan and process QR code
router.post('/scan', verifyToken, async (req, res) => {
  try {
    const { qrData } = req.body;
    const { realtimeDb } = getFirebaseServices();

    if (!qrData) {
      return res.status(400).json({ error: 'QR code data is required' });
    }

    let parsedData;
    try {
      parsedData = JSON.parse(qrData);
    } catch (parseError) {
      return res.status(400).json({ error: 'Invalid QR code format' });
    }

    if (parsedData.type !== 'payment_request') {
      return res.status(400).json({ error: 'Invalid QR code type' });
    }

    // Check if payment request exists and is valid
    const requestSnapshot = await realtimeDb.ref(`paymentRequests/${parsedData.requestId}`).once('value');
    const paymentRequest = requestSnapshot.val();

    if (!paymentRequest) {
      return res.status(404).json({ error: 'Payment request not found' });
    }

    if (paymentRequest.status !== 'pending') {
      return res.status(400).json({ error: 'Payment request is no longer valid' });
    }

    if (new Date(paymentRequest.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Payment request has expired' });
    }

    if (paymentRequest.senderId === req.user.uid) {
      return res.status(400).json({ error: 'Cannot pay yourself' });
    }

    // Get receiver's default card
    const receiverSnapshot = await realtimeDb.ref(`users/${req.user.email.replace('.', '_')}`).once('value');
    const receiverData = receiverSnapshot.val();

    if (!receiverData) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    const receiverCards = receiverData.cards || {};
    const defaultCardId = Object.keys(receiverCards).find(id => receiverCards[id].isDefault);
    
    if (!defaultCardId) {
      return res.status(400).json({ error: 'No default card set. Please link a card first.' });
    }

    res.json({
      message: 'QR code scanned successfully',
      paymentRequest: {
        id: paymentRequest.id,
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        senderName: paymentRequest.senderName,
        description: paymentRequest.description,
        expiresAt: paymentRequest.expiresAt
      },
      receiverCard: {
        id: defaultCardId,
        last4: receiverCards[defaultCardId].last4,
        brand: receiverCards[defaultCardId].brand,
        bank: receiverCards[defaultCardId].bank
      }
    });

  } catch (error) {
    console.error('Scan QR code error:', error);
    res.status(500).json({ error: 'Failed to scan QR code', details: error.message });
  }
});

// Confirm payment after QR scan
router.post('/confirm-payment', verifyToken, async (req, res) => {
  try {
    const { requestId, receiverCardId } = req.body;
    const { realtimeDb } = getFirebaseServices();

    if (!requestId || !receiverCardId) {
      return res.status(400).json({ error: 'Request ID and receiver card ID are required' });
    }

    // Get payment request
    const requestSnapshot = await realtimeDb.ref(`paymentRequests/${requestId}`).once('value');
    const paymentRequest = requestSnapshot.val();

    if (!paymentRequest) {
      return res.status(404).json({ error: 'Payment request not found' });
    }

    if (paymentRequest.status !== 'pending') {
      return res.status(400).json({ error: 'Payment request is no longer valid' });
    }

    if (new Date(paymentRequest.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Payment request has expired' });
    }

    if (paymentRequest.senderId === req.user.uid) {
      return res.status(400).json({ error: 'Cannot pay yourself' });
    }

    // Get receiver's card
    const receiverCardRef = realtimeDb.ref(`users/${req.user.email.replace('.', '_')}/cards/${receiverCardId}`);
    const receiverCardSnapshot = await receiverCardRef.once('value');
    const receiverCardData = receiverCardSnapshot.val();

    if (!receiverCardData) {
      return res.status(404).json({ error: 'Receiver card not found' });
    }

    // Get sender's default card
    const senderSnapshot = await realtimeDb.ref(`users/${paymentRequest.senderEmail.replace('.', '_')}`).once('value');
    const senderData = senderSnapshot.val();

    if (!senderData) {
      return res.status(404).json({ error: 'Sender not found' });
    }

    const senderCards = senderData.cards || {};
    const senderDefaultCardId = Object.keys(senderCards).find(id => senderCards[id].isDefault);
    
    if (!senderDefaultCardId) {
      return res.status(400).json({ error: 'Sender has no default card set' });
    }

    const senderCardData = senderCards[senderDefaultCardId];

    // Simulate payment processing
    // The receiver is paying the sender, so money flows from receiver to sender
    const { simulateCrossBankTransfer } = require('../config/stripe');
    const transferResult = await simulateCrossBankTransfer(
      { number: receiverCardData.paymentMethodId }, // Receiver's card (money source)
      { number: senderCardData.paymentMethodId },    // Sender's card (money destination)
      paymentRequest.amount
    );

    if (!transferResult.success) {
      return res.status(400).json({ error: 'Payment failed', details: transferResult.error });
    }

    // Update payment request status
    await realtimeDb.ref(`paymentRequests/${requestId}`).update({
      status: 'completed',
      completedAt: new Date().toISOString(),
      receiverId: req.user.uid,
      receiverEmail: req.user.email
    });

    // Create transaction records
    const transactionId = uuidv4();
    const timestamp = new Date().toISOString();

    // Receiver transaction (money going out - paying the sender)
    const receiverTransaction = {
      id: transactionId,
      userId: req.user.uid,
      type: 'send',
      amount: paymentRequest.amount,
      currency: paymentRequest.currency,
      receiverEmail: paymentRequest.senderEmail,
      receiverName: paymentRequest.senderName,
      description: paymentRequest.description,
      status: 'completed',
      timestamp: timestamp,
      senderBank: transferResult.senderBank,
      receiverBank: transferResult.receiverBank
    };

    // Sender transaction (money coming in - receiving from receiver)
    const senderTransaction = {
      id: transactionId,
      userId: paymentRequest.senderId,
      type: 'receive',
      amount: paymentRequest.amount,
      currency: paymentRequest.currency,
      senderEmail: req.user.email,
      senderName: `${req.user.firstName} ${req.user.lastName}`,
      description: paymentRequest.description,
      status: 'completed',
      timestamp: timestamp,
      senderBank: transferResult.senderBank,
      receiverBank: transferResult.receiverBank
    };

    // Save transactions to Firebase
    await realtimeDb.ref(`transactions/${transactionId}`).set(receiverTransaction);
    await realtimeDb.ref(`transactions/${transactionId}_sender`).set(senderTransaction);

    res.json({
      message: 'Payment confirmed successfully',
      transaction: {
        id: transactionId,
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        senderName: paymentRequest.senderName,
        receiverName: `${req.user.firstName} ${req.user.lastName}`,
        senderBank: transferResult.senderBank,
        receiverBank: transferResult.receiverBank,
        timestamp: timestamp,
        status: 'completed'
      }
    });

  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ error: 'Payment confirmation failed', details: error.message });
  }
});

// Get active payment requests for a user
router.get('/requests', verifyToken, async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    const { realtimeDb } = getFirebaseServices();
    
    const requestsRef = realtimeDb.ref('paymentRequests')
      .orderByChild('senderId')
      .equalTo(req.user.uid);

    const snapshot = await requestsRef.once('value');
    const requests = snapshot.val() || {};

    // Filter by status and convert to array
    const requestArray = Object.keys(requests)
      .map(id => ({ id, ...requests[id] }))
      .filter(request => request.status === status)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ requests: requestArray });

  } catch (error) {
    console.error('Get payment requests error:', error);
    res.status(500).json({ error: 'Failed to get payment requests', details: error.message });
  }
});

module.exports = router;