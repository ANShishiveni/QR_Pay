import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBvQ8K9X2L3M4N5O6P7Q8R9S0T1U2V3W4X",
  authDomain: "qr-money-transfer.firebaseapp.com",
  databaseURL: "https://qr-money-transfer-default-rtdb.firebaseio.com",
  projectId: "qr-money-transfer",
  storageBucket: "qr-money-transfer.appspot.com",
  messagingSenderId: "113446707674615372792",
  appId: "1:113446707674615372792:web:your-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const database = getDatabase(app);

export default app;