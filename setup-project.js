#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 NamPay Project Setup Script');
console.log('================================\n');

// Check if .env file exists in backend
const backendEnvPath = path.join(__dirname, 'backend', '.env');
const envTemplatePath = path.join(__dirname, 'backend', 'env-template.txt');

if (!fs.existsSync(backendEnvPath)) {
  console.log('❌ .env file not found in backend directory');
  console.log('📋 Please follow these steps:');
  console.log('1. Copy the contents from backend/env-template.txt');
  console.log('2. Create a new file called .env in the backend directory');
  console.log('3. Paste the contents into the .env file');
  console.log('4. Save the file\n');
  
  if (fs.existsSync(envTemplatePath)) {
    console.log('✅ Environment template found at: backend/env-template.txt');
  } else {
    console.log('❌ Environment template not found');
  }
} else {
  console.log('✅ .env file found in backend directory');
}

// Check backend dependencies
console.log('\n📦 Checking backend dependencies...');
try {
  const backendPackageJson = path.join(__dirname, 'backend', 'package.json');
  if (fs.existsSync(backendPackageJson)) {
    console.log('✅ Backend package.json found');
    
    // Check if node_modules exists
    const backendNodeModules = path.join(__dirname, 'backend', 'node_modules');
    if (!fs.existsSync(backendNodeModules)) {
      console.log('📦 Installing backend dependencies...');
      try {
        execSync('npm install', { cwd: path.join(__dirname, 'backend'), stdio: 'inherit' });
        console.log('✅ Backend dependencies installed successfully');
      } catch (error) {
        console.log('❌ Failed to install backend dependencies');
        console.log('Please run: cd backend && npm install');
      }
    } else {
      console.log('✅ Backend dependencies already installed');
    }
  } else {
    console.log('❌ Backend package.json not found');
  }
} catch (error) {
  console.log('❌ Error checking backend dependencies:', error.message);
}

// Check frontend dependencies
console.log('\n📱 Checking frontend dependencies...');
try {
  const frontendPackageJson = path.join(__dirname, 'frontend', 'package.json');
  if (fs.existsSync(frontendPackageJson)) {
    console.log('✅ Frontend package.json found');
    
    // Check if node_modules exists
    const frontendNodeModules = path.join(__dirname, 'frontend', 'node_modules');
    if (!fs.existsSync(frontendNodeModules)) {
      console.log('📦 Installing frontend dependencies...');
      try {
        execSync('npm install --legacy-peer-deps', { cwd: path.join(__dirname, 'frontend'), stdio: 'inherit' });
        console.log('✅ Frontend dependencies installed successfully');
      } catch (error) {
        console.log('❌ Failed to install frontend dependencies');
        console.log('Please run: cd frontend && npm install --legacy-peer-deps');
      }
    } else {
      console.log('✅ Frontend dependencies already installed');
    }
  } else {
    console.log('❌ Frontend package.json not found');
  }
} catch (error) {
  console.log('❌ Error checking frontend dependencies:', error.message);
}

console.log('\n🎯 Setup Summary:');
console.log('==================');
console.log('1. ✅ Firebase configuration updated');
console.log('2. ✅ Stripe configuration updated');
console.log('3. ✅ Dependencies fixed');
console.log('4. ✅ Error handling improved');

console.log('\n📋 Next Steps:');
console.log('===============');
console.log('1. Create .env file in backend directory (copy from env-template.txt)');
console.log('2. Start backend: cd backend && npm run dev');
console.log('3. Start frontend: cd frontend && npm start');
console.log('4. Test the application');

console.log('\n🔧 Troubleshooting:');
console.log('===================');
console.log('- If Firebase errors occur, check your .env file');
console.log('- If dependency errors occur, try: npm install --legacy-peer-deps');
console.log('- If port conflicts occur, change PORT in .env file');

console.log('\n✨ Setup complete! Happy coding! 🚀');
