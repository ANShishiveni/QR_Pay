import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { otpAPI } from '../../config/api';
import toastService from '../../services/toastService';

const OTPVerificationScreen = ({ route, navigation }) => {
  const { phoneNumber, purpose = 'payment_verification', paymentRequest, receiverCard } = route.params;
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [canResend, setCanResend] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  
  const inputRefs = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    // Start countdown timer
    startTimer();
    
    // Send initial OTP
    sendOTP();
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const sendOTP = async () => {
    try {
      setIsLoading(true);
      const response = await otpAPI.sendOTP(phoneNumber, purpose);
      
      if (response.data.success) {
        setSessionId(response.data.sessionId);
        setTimeLeft(300);
        setCanResend(false);
        startTimer();
        toastService.success('Success', 'OTP sent to your phone number');
      } else {
        toastService.error('Error', response.data.error || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('Send OTP error:', error);
      toastService.error('Error', 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resendOTP = async () => {
    if (!canResend) return;
    
    try {
      setIsLoading(true);
      const response = await otpAPI.resendOTP(phoneNumber, purpose);
      
      if (response.data.success) {
        setSessionId(response.data.sessionId);
        setTimeLeft(300);
        setCanResend(false);
        startTimer();
        setOtp(['', '', '', '', '', '']);
        toastService.success('Success', 'OTP resent to your phone number');
      } else {
        toastService.error('Error', response.data.error || 'Failed to resend OTP');
      }
    } catch (error) {
      console.error('Resend OTP error:', error);
      toastService.error('Error', 'Failed to resend OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (value, index) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key, index) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyOTP = async () => {
    const otpString = otp.join('');
    
    if (otpString.length !== 6) {
      toastService.error('Validation Error', 'Please enter the complete 6-digit OTP');
      return;
    }

    if (!sessionId) {
      toastService.error('Session Expired', 'Session expired. Please request a new OTP');
      return;
    }

    try {
      setIsLoading(true);
      const response = await otpAPI.verifyOTP(sessionId, otpString);
      
      if (response.data.success) {
        // Process payment if this is a payment verification
        if (purpose === 'payment_verification' && paymentRequest && receiverCard) {
          await processPayment(sessionId);
        } else {
          toastService.success('Success', 'OTP verified successfully');
          setTimeout(() => navigation.goBack(), 1000);
        }
      } else {
        setAttemptsLeft(response.data.attemptsLeft || attemptsLeft - 1);
        toastService.error('Verification Failed', response.data.error || 'Invalid OTP');
        
        if (attemptsLeft <= 1) {
          toastService.error('Max Attempts Exceeded', 'Maximum attempts exceeded. Please request a new OTP');
          setTimeout(() => navigation.goBack(), 2000);
        }
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      toastService.error('Verification Failed', 'Failed to verify OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const processPayment = async (sessionId) => {
    try {
      const { qrAPI } = require('../../config/api');
      
      const response = await qrAPI.confirmPayment({
        requestId: paymentRequest.id,
        receiverCardId: receiverCard.id,
        sessionId: sessionId,
      });

      const { transaction } = response.data;

      toastService.success(
        'Payment Successful!',
        `You have successfully paid N$ ${transaction.amount.toFixed(2)} to ${transaction.senderName}.`
      );
      
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
      }, 2000);
    } catch (error) {
      console.error('Payment error:', error);
      toastService.error(
        'Payment Failed',
        error.response?.data?.error || 'An error occurred during payment processing. Please try again.'
      );
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isOtpComplete = otp.every(digit => digit !== '');

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verify OTP</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="shield-checkmark" size={80} color="#4CAF50" />
          </View>

          <Text style={styles.title}>Enter Verification Code</Text>
          <Text style={styles.subtitle}>
            We've sent a 6-digit code to{'\n'}
            <Text style={styles.phoneNumber}>{phoneNumber}</Text>
          </Text>

          {/* OTP Input */}
          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={[
                  styles.otpInput,
                  digit ? styles.otpInputFilled : null
                ]}
                value={digit}
                onChangeText={(value) => handleOtpChange(value, index)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                keyboardType="numeric"
                maxLength={1}
                textAlign="center"
                selectTextOnFocus
              />
            ))}
          </View>

          {/* Timer */}
          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>
              {timeLeft > 0 ? `Code expires in ${formatTime(timeLeft)}` : 'Code expired'}
            </Text>
          </View>

          {/* Resend Button */}
          <TouchableOpacity
            style={[styles.resendButton, !canResend && styles.resendButtonDisabled]}
            onPress={resendOTP}
            disabled={!canResend || isLoading}
          >
            <Text style={[styles.resendButtonText, !canResend && styles.resendButtonTextDisabled]}>
              Resend Code
            </Text>
          </TouchableOpacity>

          {/* Attempts Left */}
          {attemptsLeft < 3 && (
            <Text style={styles.attemptsText}>
              {attemptsLeft} attempts remaining
            </Text>
          )}

          {/* Verify Button */}
          <TouchableOpacity
            style={[
              styles.verifyButton,
              (!isOtpComplete || isLoading) && styles.verifyButtonDisabled
            ]}
            onPress={verifyOTP}
            disabled={!isOtpComplete || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.verifyButtonText}>Verify OTP</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1E1E',
  },
  keyboardView: {
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
  content: {
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
    marginBottom: 15,
  },
  subtitle: {
    fontSize: 16,
    color: '#B0B0B0',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 22,
  },
  phoneNumber: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    width: '100%',
  },
  otpInput: {
    width: 45,
    height: 55,
    borderWidth: 2,
    borderColor: '#404040',
    borderRadius: 12,
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    backgroundColor: '#2D2D2D',
  },
  otpInputFilled: {
    borderColor: '#4CAF50',
    backgroundColor: '#1B5E20',
  },
  timerContainer: {
    marginBottom: 20,
  },
  timerText: {
    fontSize: 14,
    color: '#B0B0B0',
    textAlign: 'center',
  },
  resendButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
  resendButtonText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '600',
    textAlign: 'center',
  },
  resendButtonTextDisabled: {
    color: '#666666',
  },
  attemptsText: {
    fontSize: 14,
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 20,
  },
  verifyButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  verifyButtonDisabled: {
    backgroundColor: '#404040',
    opacity: 0.6,
  },
  verifyButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default OTPVerificationScreen;
