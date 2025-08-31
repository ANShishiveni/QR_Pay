import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getAnalytics } from 'firebase/analytics';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDmrGg9NO2bBVw9PhA9eyp7MezVOvpCrw4",
  authDomain: "qr-money-transfer.firebaseapp.com",
  databaseURL: "https://qr-money-transfer-default-rtdb.firebaseio.com",
  projectId: "qr-money-transfer",
  storageBucket: "qr-money-transfer.firebasestorage.app",
  messagingSenderId: "810625981288",
  appId: "1:810625981288:web:3c6fdfd048faf3df2154dd",
  measurementId: "G-XRDNE3WQXS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const database = getDatabase(app);
export const analytics = getAnalytics(app);

export default app;