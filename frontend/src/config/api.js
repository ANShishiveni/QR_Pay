import axios from 'axios';
import Constants from 'expo-constants';
import AsyncStorage from '../utils/asyncStorage';

// Base API configuration (env-driven with sensible fallback)
const API_HOST = process.env.EXPO_PUBLIC_API_URL
  || Constants?.expoConfig?.extra?.apiUrl
  || 'http://localhost:3000';
const API_BASE_URL = `${API_HOST}/api`;

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
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access (optional: trigger logout)
    }
    return Promise.reject(error);
  }
);

// Auth API endpoints
export const authAPI = {
  login: (credentials) => apiClient.post('/auth/login', credentials),
  register: (userData) => apiClient.post('/auth/register', userData),
  logout: () => apiClient.post('/auth/logout'),
  verifyToken: () => apiClient.get('/auth/verify'),
};

// User API endpoints
export const userAPI = {
  getProfile: () => apiClient.get('/users/profile'),
  updateProfile: (data) => apiClient.put('/users/profile', data),
  getTransactions: (params) => apiClient.get('/users/transactions', { params }),
  getBalance: () => apiClient.get('/users/balance'),
  getStats: () => apiClient.get('/users/stats'),
  uploadPhoto: (data) => apiClient.post('/users/photo', data),
  changePassword: (passwordData) => apiClient.put('/users/password', passwordData),
};

// Payment API endpoints
export const paymentAPI = {
  getCards: () => apiClient.get('/payments/cards'),
  addCard: (cardData) => apiClient.post('/payments/link-card', cardData),
  removeCard: (cardId) => apiClient.delete(`/payments/remove-card/${cardId}`),
  setDefaultCard: (cardId) => apiClient.put(`/payments/set-default-card/${cardId}`),
  makePayment: (paymentData) => apiClient.post('/payments/process-payment', paymentData),
  getPaymentHistory: () => apiClient.get('/payments/history'),
};

// QR API endpoints
export const qrAPI = {
  generateQR: (data) => apiClient.post('/qr/generate', data),
  scanQR: (qrData) => apiClient.post('/qr/scan', qrData),
  confirmPayment: (paymentData) => apiClient.post('/qr/confirm-payment', paymentData),
  getQRHistory: () => apiClient.get('/qr/history'),
};

// OTP API endpoints
export const otpAPI = {
  sendOTP: (phoneNumber, purpose) => apiClient.post('/otp/send', { phoneNumber, purpose }),
  verifyOTP: (sessionId, otp) => apiClient.post('/otp/verify', { sessionId, otp }),
  resendOTP: (phoneNumber, purpose) => apiClient.post('/otp/resend', { phoneNumber, purpose }),
  getOTPStatus: (sessionId) => apiClient.get(`/otp/status/${sessionId}`),
};

export default apiClient;
