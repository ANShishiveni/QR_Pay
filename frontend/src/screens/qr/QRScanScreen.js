import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Text,
  ActivityIndicator,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera } from 'expo-camera';
// Using expo-camera for barcode scanning (expo-barcode-scanner is deprecated)
import { Ionicons } from '@expo/vector-icons';
import { qrAPI } from '../../config/api';
import { theme, colors, spacing, typography } from '../../styles/theme';

const { width, height } = Dimensions.get('window');

export default function QRScanScreen({ navigation }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [receiverCard, setReceiverCard] = useState(null);

  useEffect(() => {
    getCameraPermissions();
  }, []);

  const getCameraPermissions = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const handleBarCodeScanned = async ({ type, data }) => {
    if (scanned || isProcessing) return;

    setScanned(true);
    setIsProcessing(true);

    try {
      // Parse QR code data
      const qrData = JSON.parse(data);
      
      if (qrData.type !== 'payment_request') {
        Alert.alert('Invalid QR Code', 'This is not a valid payment request QR code.');
        setIsProcessing(false);
        return;
      }

      // Process the QR code with backend
      const response = await qrAPI.scanQR({ qrData: data });
      const { paymentRequest: request, receiverCard: card } = response.data;

      setPaymentRequest(request);
      setReceiverCard(card);

      // Navigate to payment confirmation screen
      navigation.navigate('PaymentConfirm', {
        paymentRequest: request,
        receiverCard: card,
      });

    } catch (error) {
      console.error('QR scan error:', error);
      Alert.alert(
        'Scan Error',
        error.response?.data?.error || 'Failed to process QR code. Please try again.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const resetScan = () => {
    setScanned(false);
    setPaymentRequest(null);
    setReceiverCard(null);
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
          theme={{
            colors: {
              primary: colors.primary,
            },
          }}
        >
          Grant Permission
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Ionicons name="scan" size={32} color={colors.white} />
          <Title style={styles.headerTitle}>Scan QR Code</Title>
          <Paragraph style={styles.headerSubtitle}>
            Point your camera at a payment request QR code
          </Paragraph>
        </View>
      </LinearGradient>

      {/* Camera View */}
      <View style={styles.cameraContainer}>
        <Camera
          onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
          style={styles.camera}
        />

        {/* Overlay */}
        <View style={styles.overlay}>
          <View style={styles.scanArea}>
            <View style={styles.corner} style={[styles.corner, styles.topLeft]} />
            <View style={styles.corner} style={[styles.corner, styles.topRight]} />
            <View style={styles.corner} style={[styles.corner, styles.bottomLeft]} />
            <View style={styles.corner} style={[styles.corner, styles.bottomRight]} />
          </View>
        </View>

        {/* Processing Overlay */}
        {isProcessing && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color={colors.white} />
            <Text style={styles.processingText}>Processing QR Code...</Text>
          </View>
        )}
      </View>

      {/* Instructions */}
      <Card style={styles.instructionsCard}>
        <Card.Content>
          <Title style={styles.instructionsTitle}>How to scan:</Title>
          <View style={styles.instructionItem}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.instructionText}>
              Position the QR code within the frame above
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.instructionText}>
              Make sure the QR code is clearly visible
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.instructionText}>
              The app will automatically detect and process the code
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={styles.actionButton}
          icon="arrow-left"
          theme={{
            colors: {
              primary: colors.primary,
            },
          }}
        >
          Back
        </Button>

        {scanned && (
          <Button
            mode="contained"
            onPress={resetScan}
            style={styles.actionButton}
            icon="refresh"
            theme={{
              colors: {
                primary: colors.primary,
              },
            }}
          >
            Scan Again
          </Button>
        )}
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
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    fontSize: typography.body1.fontSize,
    color: colors.white,
    marginTop: spacing.md,
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