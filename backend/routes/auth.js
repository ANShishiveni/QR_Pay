const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getFirebaseServices } = require('../config/firebase');

const router = express.Router();

const jwtSecret = jwtSecret;
if (!jwtSecret) {
  throw new Error('JWT_SECRET must be set in the environment');
}

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phoneNumber } = req.body;

    // Validate input
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get Firebase services
    const { auth, realtimeDb } = getFirebaseServices();

    // Sanitize email for Firebase database key
    const sanitizedEmail = email.replace(/[.#$[\]]/g, '_');

    // Check if user already exists
    const existingUser = await realtimeDb.ref(`users/${sanitizedEmail}`).once('value');
    if (existingUser.exists()) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
    });

    // Store user data in Realtime Database
    const userData = {
      uid: userRecord.uid,
      email,
      firstName,
      lastName,
      phoneNumber: phoneNumber || '',
      hashedPassword,
      createdAt: new Date().toISOString(),
      isVerified: false,
      cards: {}
    };

    await realtimeDb.ref(`users/${sanitizedEmail}`).set(userData);

    // Generate JWT token
    const token = jwt.sign(
      { 
        uid: userRecord.uid, 
        email,
        firstName,
        lastName
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        uid: userRecord.uid,
        email,
        firstName,
        lastName,
        phoneNumber: phoneNumber || ''
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get Firebase services
    const { realtimeDb } = getFirebaseServices();

    // Sanitize email for Firebase database key
    const sanitizedEmail = email.replace(/[.#$[\]]/g, '_');

    // Get user from Realtime Database
    const userSnapshot = await realtimeDb.ref(`users/${sanitizedEmail}`).once('value');
    const userData = userSnapshot.val();

    if (!userData) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, userData.hashedPassword);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        uid: userData.uid, 
        email,
        firstName: userData.firstName,
        lastName: userData.lastName
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        uid: userData.uid,
        email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phoneNumber: userData.phoneNumber,
        isVerified: userData.isVerified
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

// Verify token endpoint
router.get('/verify', verifyToken, (req, res) => {
  res.json({
    valid: true,
    user: req.user
  });
});

// Logout (client-side token removal)
router.post('/logout', verifyToken, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

module.exports = { router, verifyToken };