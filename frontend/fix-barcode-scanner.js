#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing Expo Barcode Scanner Issue');
console.log('====================================\n');

// Check if we're in the frontend directory
if (!fs.existsSync('package.json') || !fs.existsSync('app.json')) {
  console.error('❌ Please run this script from the frontend directory');
  process.exit(1);
}

console.log('✅ Found frontend directory');

// Step 1: Clean node_modules and reinstall
console.log('\n🧹 Step 1: Cleaning dependencies...');
try {
  // Use Windows-compatible commands
  const isWindows = process.platform === 'win32';
  const removeCommand = isWindows ? 'rmdir /s /q node_modules && del package-lock.json' : 'rm -rf node_modules package-lock.json';
  
  execSync(removeCommand, { stdio: 'inherit', shell: true });
  console.log('✅ Removed old dependencies');
  
  execSync('npm install --legacy-peer-deps', { stdio: 'inherit' });
  console.log('✅ Reinstalled dependencies');
} catch (error) {
  console.error('❌ Failed to clean and reinstall dependencies:', error.message);
  process.exit(1);
}

// Step 2: Clear Expo cache
console.log('\n🗑️  Step 2: Clearing Expo cache...');
try {
  execSync('npx expo start --clear', { stdio: 'inherit' });
  console.log('✅ Expo cache cleared');
} catch (error) {
  console.error('❌ Failed to clear Expo cache:', error.message);
  process.exit(1);
}

// Step 3: Check if expo-barcode-scanner is properly installed
console.log('\n📦 Step 3: Verifying barcode scanner installation...');
try {
  const barcodeScannerPath = path.join(__dirname, 'node_modules', 'expo-barcode-scanner');
  if (fs.existsSync(barcodeScannerPath)) {
    console.log('✅ expo-barcode-scanner is installed');
    
    // Check if the native module exists
    const nativeModulePath = path.join(barcodeScannerPath, 'build', 'ExpoBarCodeScanner');
    if (fs.existsSync(nativeModulePath)) {
      console.log('✅ Native module found');
    } else {
      console.log('⚠️  Native module not found - this might be normal for web builds');
    }
  } else {
    console.error('❌ expo-barcode-scanner not found in node_modules');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error checking barcode scanner:', error.message);
}

console.log('\n🎉 Setup complete!');
console.log('\n📱 Next steps:');
console.log('1. Stop the current Expo server (Ctrl+C)');
console.log('2. Run: npx expo start');
console.log('3. Scan the QR code with your phone');
console.log('4. The barcode scanner should now work properly');

console.log('\n💡 If you still get errors:');
console.log('- Make sure you have the latest Expo Go app installed');
console.log('- Try running: npx expo install --fix');
console.log('- Check that your phone and computer are on the same network');
