#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

console.log('Starting Expo with Barcode Scanner Support');
console.log('=============================================\n');

// Check if we're in the frontend directory
if (!fs.existsSync('package.json') || !fs.existsSync('app.json')) {
  console.error('Please run this script from the frontend directory');
  process.exit(1);
}

console.log('Found frontend directory');

// Check if expo-barcode-scanner is installed
const barcodeScannerPath = require('path').join(__dirname, 'node_modules', 'expo-barcode-scanner');
if (!fs.existsSync(barcodeScannerPath)) {
  console.error('expo-barcode-scanner not found. Please run the fix script first.');
  process.exit(1);
}

console.log('expo-barcode-scanner is installed');

// Check app.json configuration
const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'));
const hasBarcodeScannerPlugin = appJson.expo.plugins?.some(plugin => 
  Array.isArray(plugin) && plugin[0] === 'expo-barcode-scanner'
);

if (!hasBarcodeScannerPlugin) {
  console.error(' expo-barcode-scanner plugin not configured in app.json');
  process.exit(1);
}

console.log('app.json is properly configured');

console.log('\n Starting Expo development server...');
console.log(' Make sure you have the Expo Go app installed on your phone');
console.log(' Ensure your phone and computer are on the same network');

try {
  // Start Expo with tunnel mode for better connectivity
  execSync('npx expo start --tunnel', { 
    stdio: 'inherit',
    cwd: __dirname 
  });
} catch (error) {
  console.error('\n Failed to start Expo:', error.message);
  console.log('\n Alternative: Try without tunnel mode:');
  console.log('   npx expo start');
  process.exit(1);
}
