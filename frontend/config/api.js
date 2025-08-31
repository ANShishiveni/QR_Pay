import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API base URL - change this to your backend server URL
const API_BASE_URL = 'http://localhost:3000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
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
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid, clear storage and redirect to login
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
      // You might want to dispatch a logout action here
    }
    return Promise.reject(error);
  }
);

// API endpoints
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  verifyToken: () => api.get('/auth/verify'),
  logout: () => api.post('/auth/logout'),
};

export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (userData) => api.put('/users/profile', userData),
  getCards: () => api.get('/users/cards'),
  getTransactions: (params) => api.get('/users/transactions', { params }),
  getStats: () => api.get('/users/stats'),
};

export const paymentAPI = {
  linkCard: (cardData) => api.post('/payments/link-card', cardData),
  setDefaultCard: (cardId) => api.put(`/payments/set-default-card/${cardId}`),
  removeCard: (cardId) => api.delete(`/payments/remove-card/${cardId}`),
  processPayment: (paymentData) => api.post('/payments/process-payment', paymentData),
  getPaymentHistory: (params) => api.get('/payments/history', { params }),
};

export const qrAPI = {
  generateQR: (qrData) => api.post('/qr/generate', qrData),
  scanQR: (qrData) => api.post('/qr/scan', qrData),
  confirmPayment: (paymentData) => api.post('/qr/confirm-payment', paymentData),
  getPaymentRequests: (params) => api.get('/qr/requests', { params }),
};

export default api;