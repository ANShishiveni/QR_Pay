# QR Money Transfer Application

A QR code mobile money transfer application prototype designed for Namibia, enabling cross-bank transfers using Visa cards and QR codes.

## Features

- User registration and authentication
- Visa card linking with tokenization
- QR code generation and scanning
- Cross-bank money transfers
- Transaction history
- End-to-end encryption
- PCI DSS compliance simulation

## Tech Stack

- **Frontend**: React Native with Expo
- **Backend**: Node.js with Express.js
- **Database**: Firebase Realtime Database
- **Authentication**: Firebase Auth
- **Payments**: Stripe API (sandbox)
- **QR Codes**: ZXing library

## Setup Instructions

### 1. API Keys Setup

#### Firebase Setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project named "qr-money-transfer"
3. Enable Authentication (Email/Password)
4. Enable Realtime Database
5. Get your Firebase config from Project Settings > General > Your apps
6. Add the config to `frontend/config/firebase.js`

#### Stripe Setup
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Create a new account or sign in
3. Go to Developers > API keys
4. Copy your Publishable key and Secret key (use test keys)
5. Add them to your environment variables

### 2. Installation

```bash
# Install all dependencies
npm run install-all

# Start backend server
npm run dev

# Start frontend (in another terminal)
npm run client
```

### 3. Environment Variables

Create a `.env` file in the backend directory:

```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
JWT_SECRET=your-jwt-secret
```

## Project Structure

```
qr-money-transfer/
├── frontend/          # React Native app
├── backend/           # Node.js server
├── docs/             # Documentation
└── README.md
```

## Testing

The application uses sandbox APIs for testing:
- Stripe test cards for payment simulation
- Firebase emulator for local development
- Mock bank IDs for cross-bank transfers

## License

MIT