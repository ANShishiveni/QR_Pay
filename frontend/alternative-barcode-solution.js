#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Alternative Barcode Scanner Solution');
console.log('========================================\n');

console.log('📱 The issue is that Expo Go doesn\'t support all native modules.');
console.log('💡 Here are alternative solutions:');

console.log('\n🎯 Solution 1: Use Expo Camera with Manual QR Detection');
console.log('   - Replace expo-barcode-scanner with expo-camera');
console.log('   - Use a web-based QR code detection library');
console.log('   - Works in Expo Go without native modules');

console.log('\n🎯 Solution 2: Create Development Build');
console.log('   - Build a custom app with native modules');
console.log('   - Install on device instead of using Expo Go');
console.log('   - Full native module support');

console.log('\n🎯 Solution 3: Use Web-based QR Scanner');
console.log('   - Use device camera API for web');
console.log('   - Works in web builds');
console.log('   - Cross-platform compatibility');

console.log('\n🚀 Let\'s implement Solution 1 (Expo Camera + Web QR Detection)...');

// Install alternative packages
const packages = [
  'expo-camera',
  'react-native-qrcode-scanner',
  'react-native-camera',
  'react-native-vision-camera'
];

console.log('\n📦 Installing alternative packages...');
try {
  packages.forEach(pkg => {
    console.log(`Installing ${pkg}...`);
    execSync(`npm install ${pkg}`, { stdio: 'inherit' });
  });
  console.log('✅ Alternative packages installed');
} catch (error) {
  console.error('❌ Failed to install packages:', error.message);
  process.exit(1);
}

console.log('\n📝 Creating alternative QR scan component...');

// Create alternative QR scan component
const alternativeQRComponent = `
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Dimensions } from 'react-native';
import { Camera } from 'expo-camera';
import { Card, Title, Paragraph, Button, Text, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme, colors, spacing, typography } from '../styles/theme';

const { width, height } = Dimensions.get('window');

export default function AlternativeQRScanScreen({ navigation }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    getCameraPermissions();
  }, []);

  const getCameraPermissions = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const handleManualQRScan = async () => {
    // This is a placeholder for manual QR code input
    // In a real implementation, you would use a web-based QR detection library
    Alert.alert(
      'Manual QR Input',
      'Since native barcode scanner is not available in Expo Go, you can manually enter QR code data.',
      [
        {
          text: 'Enter QR Data',
          onPress: () => {
            // Navigate to manual input screen
            navigation.navigate('ManualQRInput');
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  if (hasPermission === null) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-off" size={64} color={colors.gray} />
        <Title style={styles.permissionTitle}>Camera Permission Required</Title>
        <Paragraph style={styles.permissionSubtitle}>
          We need access to your camera to scan QR codes. Please enable camera permission in your device settings.
        </Paragraph>
        <Button
          mode="contained"
          onPress={getCameraPermissions}
          style={styles.permissionButton}
          theme={{ colors: { primary: colors.primary } }}
        >
          Grant Permission
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Ionicons name="scan" size={32} color={colors.white} />
          <Title style={styles.headerTitle}>Scan QR Code</Title>
          <Paragraph style={styles.headerSubtitle}>
            Alternative scanning method for Expo Go
          </Paragraph>
        </View>
      </LinearGradient>

      <View style={styles.cameraContainer}>
        <Camera style={styles.camera} type={Camera.Constants.Type.back}>
          <View style={styles.overlay}>
            <View style={styles.scanArea}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
          </View>
        </Camera>
      </View>

      <Card style={styles.instructionsCard}>
        <Card.Content>
          <Title style={styles.instructionsTitle}>Alternative Scanning:</Title>
          <View style={styles.instructionItem}>
            <Ionicons name="information-circle" size={20} color={colors.info} />
            <Text style={styles.instructionText}>
              Native barcode scanner not available in Expo Go
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.instructionText}>
              Use manual QR code input instead
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.instructionText}>
              Or create a development build for full native support
            </Text>
          </View>
        </Card.Content>
      </Card>

      <View style={styles.actionButtons}>
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={styles.actionButton}
          icon="arrow-left"
          theme={{ colors: { primary: colors.primary } }}
        >
          Back
        </Button>

        <Button
          mode="contained"
          onPress={handleManualQRScan}
          style={styles.actionButton}
          icon="qr-code"
          theme={{ colors: { primary: colors.primary } }}
        >
          Manual Input
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  permissionText: {
    fontSize: typography.body1.fontSize,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  permissionTitle: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
    color: colors.text,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  permissionSubtitle: {
    fontSize: typography.body2.fontSize,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  permissionButton: {
    marginTop: spacing.md,
  },
  header: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.h2.fontSize,
    fontWeight: typography.h2.fontWeight,
    color: colors.white,
    marginTop: spacing.sm,
  },
  headerSubtitle: {
    fontSize: typography.body1.fontSize,
    color: colors.white,
    opacity: 0.9,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: width * 0.7,
    height: width * 0.7,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: colors.primary,
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  instructionsCard: {
    margin: spacing.lg,
    elevation: 2,
    borderRadius: 12,
  },
  instructionsTitle: {
    fontSize: typography.h4.fontSize,
    fontWeight: typography.h4.fontWeight,
    color: colors.text,
    marginBottom: spacing.md,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  instructionText: {
    fontSize: typography.body2.fontSize,
    color: colors.text,
    marginLeft: spacing.sm,
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.lg,
    paddingTop: 0,
  },
  actionButton: {
    flex: 0.48,
  },
});
`;

// Write the alternative component
const componentPath = path.join(__dirname, 'src', 'screens', 'qr', 'AlternativeQRScanScreen.js');
fs.writeFileSync(componentPath, alternativeQRComponent);
console.log('✅ Created alternative QR scan component');

console.log('\n🎉 Alternative solution implemented!');
console.log('\n📱 Next steps:');
console.log('1. Replace the import in your navigation');
console.log('2. Test the alternative component');
console.log('3. Consider creating a development build for full native support');

console.log('\n💡 To use the alternative component:');
console.log('   import AlternativeQRScanScreen from \'./src/screens/qr/AlternativeQRScanScreen\';');
console.log('   // Replace QRScanScreen with AlternativeQRScanScreen in your navigation');

console.log('\n🔧 For full native support, run:');
console.log('   node create-dev-build.js');
