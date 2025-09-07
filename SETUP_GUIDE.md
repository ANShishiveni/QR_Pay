# QR Money Transfer - Setup Guide

This guide will walk you through setting up the QR Money Transfer application with all necessary APIs and configurations.

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

## 1. Firebase Setup

### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: `qr-money-transfer`
4. Enable Google Analytics (optional)
5. Click "Create project"

### Step 2: Enable Authentication
1. In Firebase Console, go to "Authentication" > "Sign-in method"
2. Enable "Email/Password" provider
3. Click "Save"

### Step 3: Enable Realtime Database
1. Go to "Realtime Database" in Firebase Console
2. Click "Create Database"
3. Choose "Start in test mode" (for development)
4. Select a location (choose closest to your region)
5. Click "Done"

### Step 4: Get Firebase Configuration
1. Go to Project Settings (gear icon) > "General"
2. Scroll down to "Your apps" section
3. Click "Add app" > Web app (</>) icon
4. Register app with name: `qr-money-transfer-web`
5. Copy the Firebase configuration object

### Step 5: Generate Service Account Key
1. Go to Project Settings > "Service accounts"
2. Click "Generate new private key"
3. Download the JSON file
4. Keep this file secure - it contains sensitive credentials

### Step 6: Update Firebase Configuration
1. Open `frontend/config/firebase.js`
2. The Firebase configuration is already set up with your project details:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyBvQ8K9X2L3M4N5O6P7Q8R9S0T1U2V3W4X",
  authDomain: "qr-money-transfer.firebaseapp.com",
  databaseURL: "https://qr-money-transfer-default-rtdb.firebaseio.com",
  projectId: "qr-money-transfer",
  storageBucket: "qr-money-transfer.appspot.com",
  messagingSenderId: "113446707674615372792",
  appId: "1:113446707674615372792:web:your-app-id"
};
```

**Note**: You may need to get the actual API key and App ID from your Firebase project settings.

## 2. Stripe Setup

### Step 1: Create Stripe Account
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Sign up for a new account or sign in
3. Complete account verification (use test mode for development)

### Step 2: Get API Keys
1. In Stripe Dashboard, go to "Developers" > "API keys"
2. Copy your "Publishable key" (starts with `pk_test_`)
3. Copy your "Secret key" (starts with `sk_test_`)
4. Keep these keys secure

### Step 3: Update Stripe Configuration
1. Create a `.env` file in the `backend` directory
2. Add your Stripe keys:

```env
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
```

## 3. Backend Setup

### Step 1: Install Dependencies
```bash
cd backend
npm install
```

### Step 2: Environment Configuration
1. The `.env` file is already created with your Firebase credentials
2. You only need to add your Stripe keys to the `.env` file:

```env
# Firebase Configuration (Already configured)
FIREBASE_PROJECT_ID=qr-money-transfer
FIREBASE_PRIVATE_KEY_ID=2cb618a2ad2460813f878a14f6614d97141914aa
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n[Your private key is already configured]\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@qr-money-transfer.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=113446707674615372792

# Stripe Configuration (Add your keys here)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key

# JWT Configuration (Already configured)
JWT_SECRET=your-super-secret-jwt-key-for-qr-money-transfer-app

# Server Configuration (Already configured)
PORT=3000
NODE_ENV=development
```

### Step 3: Start Backend Server
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## 4. Frontend Setup

### Step 1: Install Dependencies
```bash
cd frontend
npm install
```

### Step 2: Update API Configuration
1. Open `frontend/config/api.js`
2. Update the `API_BASE_URL` if your backend is running on a different port:

```javascript
const API_BASE_URL = 'http://localhost:3000/api';
```

### Step 3: Start Frontend
```bash
npm start
```

This will start the Expo development server.

## 5. Testing the Application

### Test Cards
The application includes test card numbers for different "banks":

- **FNB**: 4242424242424242
- **Standard Bank**: 4000056655665556
- **Bank Windhoek**: 5555555555554444
- **Nedbank**: 2223003122003222

Visa: 4111 1111 1111 1111
Mastercard: 5555 5555 5555 4444
Amex: 3782 822463 10005
FNB: 4242 4242 4242 4242
Standard Bank: 4000 0566 5566 5556

Use any future expiry date and any 3-digit CVC.

### Testing Flow
1. Register a new account
2. Add a test card
3. Generate a QR code for payment
4. Scan the QR code with another device/account
5. Complete the payment

## 6. Troubleshooting

### Common Issues

#### Firebase Connection Issues
- Verify your Firebase configuration is correct
- Check that Authentication and Realtime Database are enabled
- Ensure your service account key is properly formatted

#### Stripe Integration Issues
- Verify you're using test keys (not live keys)
- Check that your Stripe account is properly set up
- Ensure the secret key is correctly set in environment variables

#### Backend Connection Issues
- Verify the backend server is running on the correct port
- Check that CORS is properly configured
- Ensure all environment variables are set

#### Frontend Build Issues
- Clear Expo cache: `expo start -c`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check that all required permissions are granted

### Getting Help
- Check the console logs for detailed error messages
- Verify all API keys and configurations are correct
- Ensure all dependencies are properly installed

## 7. Production Deployment

### Security Considerations
- Never commit API keys or sensitive data to version control
- Use environment variables for all configuration
- Enable proper CORS settings for production
- Use HTTPS in production
- Implement proper error handling and logging

### Deployment Options
- **Backend**: Deploy to Heroku, AWS, or similar cloud platform
- **Frontend**: Build and deploy to app stores or web hosting
- **Database**: Use Firebase production database with proper security rules

## 8. Additional Features (Future Enhancements)

- Push notifications for payment confirmations
- Biometric authentication
- Multi-currency support
- Advanced security features
- Admin dashboard
- Analytics and reporting

---

**Note**: This is a prototype application for demonstration purposes. Do not use for real financial transactions without proper security audits and compliance with financial regulations.