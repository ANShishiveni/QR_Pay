import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import biometricService from '../../services/biometricService';

const BiometricAuthScreen = ({ route, navigation }) => {
  const { amount, recipient, phoneNumber } = route.params;
  
  const [isLoading, setIsLoading] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    checkBiometricStatus();
  }, []);

  const checkBiometricStatus = async () => {
    try {
      setIsLoading(true);
      console.log('Checking biometric status...');
      const status = await biometricService.getStatus();
      console.log('Biometric status:', status);
      setBiometricStatus(status);
    } catch (error) {
      console.error('Failed to check biometric status:', error);
      setBiometricStatus({
        isAvailable: false,
        isEnrolled: false,
        supportedTypes: [],
        canUseBiometrics: false,
        error: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricAuth = async () => {
    try {
      setIsAuthenticating(true);
      const result = await biometricService.authenticateForPayment(amount, recipient);
      
      if (result.success) {
        Alert.alert('Success', 'Biometric authentication successful', [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to payment confirmation with success
              navigation.navigate('PaymentConfirm', { 
                paymentRequest: route.params.paymentRequest,
                receiverCard: route.params.receiverCard,
                biometricVerified: true 
              });
            }
          }
        ]);
      } else {
        Alert.alert('Authentication Failed', result.error || 'Biometric authentication failed');
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      Alert.alert('Error', 'Biometric authentication failed. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleFallback = () => {
    // Navigate to OTP verification
    navigation.navigate('OTPVerification', {
      phoneNumber: phoneNumber || '+264816294914', // Use passed phone number or fallback
      purpose: 'payment_verification',
    });
  };

  const getBiometricIcon = () => {
    if (!biometricStatus) return 'finger-print';
    
    if (biometricStatus.supportedTypes.includes('Face ID')) {
      return 'face-recognition';
    } else if (biometricStatus.supportedTypes.includes('Fingerprint')) {
      return 'finger-print';
    } else {
      return 'shield-checkmark';
    }
  };

  const getBiometricText = () => {
    if (!biometricStatus) return 'Biometric Authentication';
    
    if (biometricStatus.supportedTypes.includes('Face ID')) {
      return 'Face ID Authentication';
    } else if (biometricStatus.supportedTypes.includes('Fingerprint')) {
      return 'Fingerprint Authentication';
    } else {
      return 'Biometric Authentication';
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Checking biometric status...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!biometricStatus?.canUse) {
    const getErrorMessage = () => {
      if (!biometricStatus) return 'Unable to check biometric status.';
      if (!biometricStatus.isAvailable) return 'This device does not support biometric authentication.';
      if (!biometricStatus.isEnrolled) return 'No biometric data is enrolled on this device. Please set up fingerprint or face recognition in your device settings.';
      return 'Biometric authentication is not available.';
    };

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="warning" size={80} color="#FF6B6B" />
          </View>
          
          <Text style={styles.title}>Biometric Not Available</Text>
          <Text style={styles.subtitle}>
            {getErrorMessage()}
          </Text>
          
          {biometricStatus?.error && (
            <Text style={styles.errorText}>
              Error: {biometricStatus.error}
            </Text>
          )}
          
          <TouchableOpacity
            style={styles.fallbackButton}
            onPress={handleFallback}
          >
            <Text style={styles.fallbackButtonText}>Use OTP Instead</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verify Identity</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Content */}
        <View style={styles.mainContent}>
          <View style={styles.iconContainer}>
            <Ionicons name={getBiometricIcon()} size={100} color="#4CAF50" />
          </View>

          <Text style={styles.title}>{getBiometricText()}</Text>
          <Text style={styles.subtitle}>
            Verify your identity to send{'\n'}
            <Text style={styles.amountText}>N$ {amount}</Text> to{'\n'}
            <Text style={styles.recipientText}>{recipient}</Text>
          </Text>

          {/* Biometric Button */}
          <TouchableOpacity
            style={[styles.biometricButton, isAuthenticating && styles.biometricButtonDisabled]}
            onPress={handleBiometricAuth}
            disabled={isAuthenticating}
          >
            {isAuthenticating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name={getBiometricIcon()} size={24} color="#FFFFFF" />
                <Text style={styles.biometricButtonText}>
                  {isAuthenticating ? 'Authenticating...' : 'Authenticate'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Fallback Button */}
          <TouchableOpacity
            style={styles.fallbackButton}
            onPress={handleFallback}
            disabled={isAuthenticating}
          >
            <Text style={styles.fallbackButtonText}>Use OTP Instead</Text>
          </TouchableOpacity>

          {/* Security Note */}
          <View style={styles.securityNote}>
            <Ionicons name="shield-checkmark" size={16} color="#4CAF50" />
            <Text style={styles.securityNoteText}>
              Your biometric data is stored securely on your device
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1E1E',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#B0B0B0',
    marginTop: 20,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#2D2D2D',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 40,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  amountText: {
    color: '#4CAF50',
    fontWeight: '700',
    fontSize: 20,
  },
  recipientText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  biometricButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 20,
    minWidth: 200,
  },
  biometricButtonDisabled: {
    backgroundColor: '#404040',
    opacity: 0.6,
  },
  biometricButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 10,
  },
  fallbackButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginBottom: 30,
  },
  fallbackButtonText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '600',
    textAlign: 'center',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2D2D2D',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  securityNoteText: {
    fontSize: 14,
    color: '#B0B0B0',
    marginLeft: 8,
    flex: 1,
  },
  errorText: {
    fontSize: 12,
    color: '#FF6B6B',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
});

export default BiometricAuthScreen;
