#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🏗️  Creating Development Build with Native Modules');
console.log('==================================================\n');

// Check if we're in the frontend directory
if (!fs.existsSync('package.json') || !fs.existsSync('app.json')) {
  console.error('❌ Please run this script from the frontend directory');
  process.exit(1);
}

console.log('✅ Found frontend directory');

console.log('\n📱 This will create a development build that includes native modules.');
console.log('💡 This is the recommended approach for apps using native modules like barcode scanner.');
console.log('💡 You\'ll need to install the development build on your device instead of using Expo Go.');

console.log('\n🔧 Prerequisites:');
console.log('1. Expo account (free)');
console.log('2. EAS CLI installed: npm install -g @expo/eas-cli');
console.log('3. Logged in to Expo: eas login');

console.log('\n📋 Steps:');
console.log('1. Install EAS CLI (if not already installed)');
console.log('2. Login to Expo');
console.log('3. Configure EAS Build');
console.log('4. Create development build');
console.log('5. Install on your device');

console.log('\n🚀 Starting setup...');

try {
  // Check if EAS CLI is installed
  console.log('\n📦 Checking EAS CLI installation...');
  execSync('eas --version', { stdio: 'pipe' });
  console.log('✅ EAS CLI is installed');
} catch (error) {
  console.log('❌ EAS CLI not found. Installing...');
  try {
    execSync('npm install -g @expo/eas-cli', { stdio: 'inherit' });
    console.log('✅ EAS CLI installed successfully');
  } catch (installError) {
    console.error('❌ Failed to install EAS CLI:', installError.message);
    console.log('\nPlease install manually: npm install -g @expo/eas-cli');
    process.exit(1);
  }
}

// Check if user is logged in
try {
  console.log('\n🔐 Checking Expo login status...');
  execSync('eas whoami', { stdio: 'pipe' });
  console.log('✅ Logged in to Expo');
} catch (error) {
  console.log('❌ Not logged in to Expo. Please login:');
  console.log('   eas login');
  process.exit(1);
}

// Create eas.json if it doesn't exist
const easJsonPath = path.join(__dirname, 'eas.json');
if (!fs.existsSync(easJsonPath)) {
  console.log('\n📝 Creating EAS configuration...');
  const easConfig = {
    "cli": {
      "version": ">= 5.9.1"
    },
    "build": {
      "development": {
        "developmentClient": true,
        "distribution": "internal"
      },
      "preview": {
        "distribution": "internal"
      },
      "production": {}
    },
    "submit": {
      "production": {}
    }
  };
  
  fs.writeFileSync(easJsonPath, JSON.stringify(easConfig, null, 2));
  console.log('✅ Created eas.json configuration');
}

console.log('\n🎯 Ready to create development build!');
console.log('\n📱 Choose your platform:');
console.log('1. Android: eas build --platform android --profile development');
console.log('2. iOS: eas build --platform ios --profile development');
console.log('3. Both: eas build --platform all --profile development');

console.log('\n💡 After the build completes:');
console.log('- Download the APK/IPA file');
console.log('- Install it on your device');
console.log('- Run: npx expo start --dev-client');
console.log('- The barcode scanner will work properly!');

console.log('\n🚀 Starting Android development build...');
try {
  execSync('eas build --platform android --profile development', { 
    stdio: 'inherit',
    cwd: __dirname 
  });
} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  console.log('\n💡 Alternative: Try iOS or check your EAS configuration');
  process.exit(1);
}
