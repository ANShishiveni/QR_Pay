const { getDefaultConfig } = require('expo/metro-config');

// One Expo-supported bundler for native and web; no Node/browser crypto shims.
module.exports = getDefaultConfig(__dirname);
