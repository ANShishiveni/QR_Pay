const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const os = require('os');
require('dotenv').config();

// Initialize Firebase Admin SDK with error handling
try {
  const { initializeFirebase } = require('./config/firebase');
  initializeFirebase();
} catch (error) {
  console.error('Failed to initialize Firebase:', error.message);
  console.error('Please check your .env file and Firebase configuration');
  process.exit(1);
}

const { router: authRoutes } = require('./routes/auth');
const userRoutes = require('./routes/users');
const paymentRoutes = require('./routes/payments');
const qrRoutes = require('./routes/qr');
const otpRoutes = require('./routes/otp');

const app = express();
const PORT = process.env.PORT || 3000;

// Detect host IP with env override
function getHostIP() {
  if (process.env.HOST_IP) return process.env.HOST_IP;
  const interfaces = os.networkInterfaces();
  const priority = ['Wi-Fi', 'Ethernet', 'en0', 'eth0'];
  for (const name of priority) {
    const list = interfaces[name];
    if (list) {
      const found = list.find((iface) => iface.family === 'IPv4' && !iface.internal);
      if (found) return found.address;
    }
  }
  for (const name of Object.keys(interfaces)) {
    const found = interfaces[name]?.find((iface) => iface.family === 'IPv4' && !iface.internal);
    if (found) return found.address;
  }
  return 'localhost';
}

const HOST_IP = getHostIP();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// CORS configuration with dynamic IP
const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://localhost:19006',
  'http://127.0.0.1:19006',
  `http://${HOST_IP}:3000`,
  `http://${HOST_IP}:19006`,
]);

app.use(cors({
  origin: (origin, callback) => {
    // Allow native app requests (no origin) and allowed dev origins
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/otp', otpRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(` Server running on port ${PORT}`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(` Health check: http://localhost:${PORT}/api/health`);
  console.log(` Network access: http://${HOST_IP}:${PORT}/api/health`);
});

module.exports = app;