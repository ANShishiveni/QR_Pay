import axios from 'axios';
import AsyncStorage from '../utils/asyncStorage';

// Base API configuration
const API_BASE_URL = 'http://10.150.26.10:3000'; // Your computer's IP address

// Test API connection
console.log('🔗 API Base URL:', API_BASE_URL);
fetch(`${API_BASE_URL}/api/health`)
  .then(response => response.json())
  .then(data => console.log('✅ Backend health check:', data))
  .catch(error => console.error('❌ Backend health check failed:', error));

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  async (config) => {
    console.log('🚀 Making API request:', config.method?.toUpperCase(), config.url);
    console.log('📦 Request data:', config.data);
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
    }
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', response.status, response.config.url);
    console.log('📦 Response data:', response.data);
    return response;
  },
  (error) => {
    console.error('❌ API Error:', error.response?.status, error.response?.data || error.message);
    console.error('🔗 Failed URL:', error.config?.url);
    if (error.response?.status === 401) {
      // Handle unauthorized access
      console.log('Unauthorized access, redirecting to login');
    }
    return Promise.reject(error);
  }
);

// Auth API endpoints
export const authAPI = {
  login: (credentials) => apiClient.post('/api/auth/login', credentials),
  register: (userData) => apiClient.post('/api/auth/register', userData),
  logout: () => apiClient.post('/api/auth/logout'),
  verifyToken: () => apiClient.get('/api/auth/verify'),
};

// User API endpoints
export const userAPI = {
  getProfile: () => apiClient.get('/api/users/profile'),
  updateProfile: (data) => apiClient.put('/api/users/profile', data),
  getTransactions: (params) => apiClient.get('/api/users/transactions', { params }),
  getBalance: () => apiClient.get('/api/users/balance'),
  getStats: () => apiClient.get('/api/users/stats'),
  uploadPhoto: (data) => apiClient.post('/api/users/photo', data),
  changePassword: (passwordData) => apiClient.put('/api/users/password', passwordData),
};

// Payment API endpoints
export const paymentAPI = {
  getCards: () => apiClient.get('/api/payments/cards'),
  addCard: (cardData) => apiClient.post('/api/payments/link-card', cardData),
  removeCard: (cardId) => apiClient.delete(`/api/payments/remove-card/${cardId}`),
  setDefaultCard: (cardId) => apiClient.put(`/api/payments/set-default-card/${cardId}`),
  makePayment: (paymentData) => apiClient.post('/api/payments/process-payment', paymentData),
  getPaymentHistory: () => apiClient.get('/api/payments/history'),
};

// QR API endpoints
export const qrAPI = {
  generateQR: (data) => apiClient.post('/api/qr/generate', data),
  scanQR: (qrData) => apiClient.post('/api/qr/scan', qrData),
  confirmPayment: (paymentData) => apiClient.post('/api/qr/confirm-payment', paymentData),
  getQRHistory: () => apiClient.get('/api/qr/history'),
};

// OTP API endpoints
export const otpAPI = {
  sendOTP: (phoneNumber, purpose) => apiClient.post('/api/otp/send', { phoneNumber, purpose }),
  verifyOTP: (sessionId, otp) => apiClient.post('/api/otp/verify', { sessionId, otp }),
  resendOTP: (phoneNumber, purpose) => apiClient.post('/api/otp/resend', { phoneNumber, purpose }),
  getOTPStatus: (sessionId) => apiClient.get(`/api/otp/status/${sessionId}`),
};

export default apiClient;
