#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Firebase Rules Deployment Script');
console.log('=====================================\n');

// Check if Firebase CLI is installed
try {
  execSync('firebase --version', { stdio: 'pipe' });
  console.log('✅ Firebase CLI is installed');
} catch (error) {
  console.log('❌ Firebase CLI not found. Installing...');
  try {
    execSync('npm install -g firebase-tools', { stdio: 'inherit' });
    console.log('✅ Firebase CLI installed successfully');
  } catch (installError) {
    console.error('❌ Failed to install Firebase CLI:', installError.message);
    console.log('\nPlease install manually: npm install -g firebase-tools');
    process.exit(1);
  }
}

// Check if database.rules.json exists
const rulesPath = path.join(__dirname, 'database.rules.json');
if (!fs.existsSync(rulesPath)) {
  console.error('❌ database.rules.json not found');
  process.exit(1);
}

console.log('✅ database.rules.json found');

// Check if user is logged in
try {
  execSync('firebase projects:list', { stdio: 'pipe' });
  console.log('✅ Firebase authentication verified');
} catch (error) {
  console.log('❌ Not authenticated with Firebase. Please login:');
  console.log('   firebase login');
  process.exit(1);
}

// Deploy rules
console.log('\n📤 Deploying Firebase database rules...');
try {
  execSync('firebase deploy --only database', { 
    stdio: 'inherit',
    cwd: __dirname 
  });
  console.log('\n✅ Firebase rules deployed successfully!');
  console.log('\n🎉 The index warnings should now be resolved.');
  console.log('   Restart your backend server to see the improvements.');
} catch (error) {
  console.error('\n❌ Failed to deploy Firebase rules:', error.message);
  console.log('\n💡 Alternative: Deploy manually via Firebase Console');
  console.log('   1. Go to Firebase Console > Realtime Database > Rules');
  console.log('   2. Copy content from database.rules.json');
  console.log('   3. Paste and publish');
  process.exit(1);
}
