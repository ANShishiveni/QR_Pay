import axios from 'axios';
import { Platform } from 'react-native';
import sessionStorage from '../services/storage/sessionStorage';
import { notifySessionExpired } from '../services/sessionEvents';
import { resolveApiHost, safeApiError } from './apiPolicy';

const isWeb = Platform.OS === 'web';
const development = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
export const API_HOST = resolveApiHost(process.env.EXPO_PUBLIC_API_URL, {
  development,
  hostname: isWeb && typeof window !== 'undefined' ? window.location.hostname : 'localhost',
});
const apiClient = axios.create({
  baseURL: `${API_HOST}/api`,
  timeout: 15000,
  withCredentials: isWeb,
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Platform': isWeb ? 'web' : 'native',
  },
});

apiClient.interceptors.request.use(async (config) => {
  if (!isWeb) {
    const token = await sessionStorage.getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const publicAuthPaths = new Set(['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password']);
apiClient.interceptors.response.use(response => response, async error => {
  const rejectedPasswordProof = error.config?.url === '/users/password' && error.response?.data?.code === 'REAUTHENTICATION_FAILED';
  if (error.response?.status === 401 && !publicAuthPaths.has(error.config?.url) && !rejectedPasswordProof) {
    // The startup verifier owns its result. A new browser without a cookie is
    // an ordinary guest, not an expired session; broadcasting here also races
    // AuthContext's in-flight verification guard.
    if (error.config?.url !== '/auth/verify') notifySessionExpired();
    try { await sessionStorage.clearToken(); } catch { /* UI still fails closed. */ }
  }
  // No automatic retries of writes: reconcile uncertain payments by request ID.
  return Promise.reject(safeApiError(error));
});

const segment = value => encodeURIComponent(String(value));
export const authAPI = {
  login: credentials => apiClient.post('/auth/login', credentials),
  register: data => apiClient.post('/auth/register', data),
  logout: () => apiClient.post('/auth/logout'),
  verifyToken: () => apiClient.get('/auth/verify'),
  getCapabilities: () => apiClient.get('/auth/capabilities'),
  forgotPassword: email => apiClient.post('/auth/forgot-password', { email }),
  resetPassword: data => apiClient.post('/auth/reset-password', data),
};
export const userAPI = {
  getProfile: () => apiClient.get('/users/profile'),
  updateProfile: data => apiClient.put('/users/profile', data),
  getTransactions: params => apiClient.get('/users/transactions', { params }),
  getStats: () => apiClient.get('/users/stats'),
  updatePreferences: data => apiClient.put('/users/preferences', data),
  uploadPhoto: data => apiClient.post('/users/photo', data),
  changePassword: async data => {
    const result = await apiClient.put('/users/password', data);
    notifySessionExpired();
    await sessionStorage.clearToken();
    return result;
  },
};
export const paymentAPI = {
  getCards: () => apiClient.get('/payments/cards'),
  getTestInstruments: () => apiClient.get('/payments/test-instruments'),
  addCard: data => apiClient.post('/payments/link-card', data),
  removeCard: id => apiClient.delete(`/payments/remove-card/${segment(id)}`),
  setDefaultCard: id => apiClient.put(`/payments/set-default-card/${segment(id)}`),
  makePayment: data => apiClient.post('/payments/process-payment', data),
  getPaymentHistory: params => apiClient.get('/payments/history', { params }),
  getTransaction: id => apiClient.get(`/payments/transactions/${segment(id)}`),
};
export const qrAPI = {
  generateQR: data => apiClient.post('/qr/generate', data),
  scanQR: data => apiClient.post('/qr/scan', typeof data === 'string' ? { qrData: data } : data),
  confirmPayment: data => apiClient.post('/qr/confirm-payment', data),
  getQRHistory: params => apiClient.get('/qr/requests', { params }),
  getRequests: params => apiClient.get('/qr/requests', { params }),
  getRequest: id => apiClient.get(`/qr/requests/${segment(id)}`),
  cancelRequest: id => apiClient.post(`/qr/requests/${segment(id)}/cancel`),
};
export const otpAPI = {
  sendOTP: (requestId, purpose = 'payment_verification') => apiClient.post('/otp/send', { requestId, purpose }),
  verifyOTP: (sessionId, otp) => apiClient.post('/otp/verify', { sessionId, otp }),
  resendOTP: (requestId, purpose = 'payment_verification') => apiClient.post('/otp/resend', { requestId, purpose }),
  getOTPStatus: id => apiClient.get(`/otp/status/${segment(id)}`),
};

export default apiClient;
