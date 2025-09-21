const os = require('os');
const fs = require('fs');
const path = require('path');

// Function to get the current network IP address
function getCurrentIP() {
  const interfaces = os.networkInterfaces();
  
  // Priority order for network interfaces
  const priorityInterfaces = ['Wi-Fi', 'Ethernet', 'en0', 'eth0'];
  
  // First, try to find Wi-Fi or Ethernet interfaces
  for (const priorityName of priorityInterfaces) {
    if (interfaces[priorityName]) {
      for (const interface of interfaces[priorityName]) {
        if (interface.family === 'IPv4' && !interface.internal) {
          console.log(`📡 Found IP on ${priorityName}: ${interface.address}`);
          return interface.address;
        }
      }
    }
  }
  
  // If no priority interface found, look for any non-internal IPv4 address
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      // Skip internal (localhost) and non-IPv4 addresses
      if (interface.family === 'IPv4' && !interface.internal) {
        console.log(`📡 Found IP on ${name}: ${interface.address}`);
        return interface.address;
      }
    }
  }
  
  return 'localhost'; // Fallback
}

// Function to update frontend API configuration
function updateFrontendConfig(ip) {
  const frontendConfigPath = path.join(__dirname, 'frontend', 'src', 'config', 'api.js');
  
  try {
    let content = fs.readFileSync(frontendConfigPath, 'utf8');
    
    // Replace the API_BASE_URL with the new IP
    const newApiUrl = `const API_BASE_URL = 'http://${ip}:3000'; // Your computer's IP address`;
    content = content.replace(
      /const API_BASE_URL = 'http:\/\/[^']+:3000'; \/\/ Your computer's IP address/,
      newApiUrl
    );
    
    fs.writeFileSync(frontendConfigPath, content, 'utf8');
    console.log(`✅ Updated frontend API config: http://${ip}:3000`);
  } catch (error) {
    console.error('❌ Error updating frontend config:', error.message);
  }
}

// Function to update backend CORS configuration
function updateBackendConfig(ip) {
  const backendConfigPath = path.join(__dirname, 'backend', 'server.js');
  
  try {
    let content = fs.readFileSync(backendConfigPath, 'utf8');
    
    // Replace the CORS origins with the new IP
    const newOrigins = [
      'http://localhost:3000', 
      'http://localhost:19006', 
      'http://127.0.0.1:19006',
      `http://${ip}:19006`,  // Phone browser accessing web version
      `exp://${ip}:8081`,   // Expo Go app
      'http://10.139.208.10:19006',  // Previous IP (keep for compatibility)
      'exp://10.139.208.10:8081',   // Previous IP (keep for compatibility)
      'exp://192.168.1.100:19000'
    ];
    
    // Create the new origin array string
    const originString = `  origin: [\n${newOrigins.map(origin => `    '${origin}',`).join('\n')}\n  ],`;
    
    // Replace the origin array in the CORS configuration
    content = content.replace(
      /origin: \[\s*[\s\S]*?\],/,
      originString
    );
    
    fs.writeFileSync(backendConfigPath, content, 'utf8');
    console.log(`✅ Updated backend CORS config for IP: ${ip}`);
  } catch (error) {
    console.error('❌ Error updating backend config:', error.message);
  }
}

// Function to update server listen message
function updateServerMessage(ip) {
  const backendConfigPath = path.join(__dirname, 'backend', 'server.js');
  
  try {
    let content = fs.readFileSync(backendConfigPath, 'utf8');
    
    // Update the network access message
    const newMessage = `  console.log(\`🌐 Network access: http://${ip}:\${PORT}/api/health\`);`;
    content = content.replace(
      /console\.log\(`🌐 Network access: http:\/\/[^`]+:\$\{PORT\}\/api\/health`\);/,
      newMessage
    );
    
    fs.writeFileSync(backendConfigPath, content, 'utf8');
    console.log(`✅ Updated server message for IP: ${ip}`);
  } catch (error) {
    console.error('❌ Error updating server message:', error.message);
  }
}

// Main function
function main() {
  console.log('🔍 Detecting current network IP address...');
  
  const currentIP = getCurrentIP();
  
  if (currentIP === 'localhost') {
    console.log('⚠️  Could not detect network IP, using localhost');
    console.log('   Make sure you are connected to a network');
    return;
  }
  
  console.log(`🌐 Current IP address: ${currentIP}`);
  console.log('📝 Updating configuration files...');
  
  // Update all configuration files
  updateFrontendConfig(currentIP);
  updateBackendConfig(currentIP);
  updateServerMessage(currentIP);
  
  console.log('🎉 IP address update complete!');
  console.log(`📱 Use this URL in Expo Go: exp://${currentIP}:8081`);
  console.log(`🌐 Backend accessible at: http://${currentIP}:3000`);
}

// Run the script
main();
