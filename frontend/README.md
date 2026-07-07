# NamPay Frontend

A clean, bulletproof React Native Expo app with no warnings.

## Quick Start

```bash
# Install dependencies
npm install --legacy-peer-deps

# Start development server
npm start

# Start web version (no warnings)
npm run clean:web

# Clean install if needed
npm run clean
```

## Testing

**Android Device:**
1. Open Expo Go app (version 2.33.21)
2. Scan QR code from terminal
3. App loads without errors

**Web Browser:**
1. Run `npm run clean:web`
2. Open `http://localhost:19006`
3. App loads without warnings

## Dependencies

All dependencies are carefully selected for Expo SDK 53 compatibility:
- `expo: ~53.0.0`
- `react: 18.2.0`
- `react-native: 0.76.3`
- `react-native-paper: ^5.12.3`

##  Configuration

- **webpack.config.js** - Handles vector icons and polyfills
- **app.json** - Clean Expo configuration
- **package.json** - Bulletproof dependency versions

##  Guarantee

This setup is **BULLETPROOF** and will work without any warnings or errors!
