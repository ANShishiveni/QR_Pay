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
import { otpAPI, qrAPI } from '../../config/api';
import * as Crypto from 'expo-crypto';
import toastService from '../../services/toastService';

const OTPVerificationScreen = ({ route, navigation }) => {
  const { purpose = 'payment_verification', paymentRequest, receiverCard } = route.params || {};
  const requestId = paymentRequest?.id || route.params?.requestId;
  const idempotencyKey = useRef(route.params?.idempotencyKey || null);
  if (!idempotencyKey.current) idempotencyKey.current = Crypto.randomUUID();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [resendAt, setResendAt] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [maskedDestination, setMaskedDestination] = useState('Server verification');
  const [provider, setProvider] = useState(null);
  const [uncertain, setUncertain] = useState(false);
  const inputRefs = useRef([]);
  const busy = useRef(false);
  const verified = useRef(false);
  const initialSent = useRef(false);

  useEffect(() => {
    if (!initialSent.current) { initialSent.current = true; sendOTP(); }
  }, []);

  useEffect(() => {
    const tick = () => {
      setTimeLeft(expiresAt ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)) : 0);
      setCanResend(Boolean(resendAt && Date.now() >= resendAt));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, resendAt]);

  const sendOTP = async (resend = false) => {
    if (busy.current || !requestId) return;
    busy.current = true;
    setIsLoading(true);
    try {
      const { data } = await (resend ? otpAPI.resendOTP(requestId, purpose) : otpAPI.sendOTP(requestId, purpose));
      if (!data.success || !data.sessionId) throw new Error('Verification could not be started.');
      setSessionId(data.sessionId);
      setExpiresAt(new Date(data.expiresAt).getTime());
      setResendAt(new Date(data.resendAt).getTime());
      setMaskedDestination(data.maskedDestination || 'Verified account destination');
      setProvider(data.provider);
      setOtp(['', '', '', '', '', '']);
      verified.current = false;
      setUncertain(false);
      toastService.info('Verification ready', data.provider === 'mock' ? 'Use the code in your local demo inbox. No SMS was sent.' : 'Check your verified destination.');
    } catch (error) {
      toastService.error('Verification unavailable', error.message);
    } finally {
      busy.current = false;
      setIsLoading(false);
    }
  };
  const resendOTP = () => { if (canResend && !uncertain) sendOTP(true); };
  const handleOtpChange = (value, index) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setOtp(previous => {
      const next = [...previous];
      if (!digits) next[index] = '';
      else for (let offset = 0; offset < digits.length && index + offset < 6; offset++) next[index + offset] = digits[offset];
      return next;
    });
    if (digits) inputRefs.current[Math.min(5, index + digits.length)]?.focus();
  };
  const handleKeyPress = (key, index) => {
    if (key === 'Backspace' && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };
  const completed = (transaction) => {
    if (!transaction || transaction.status !== 'completed') throw new Error('The payment result is not yet confirmed.');
    setUncertain(false);
    toastService.success('Simulated payment completed', 'No real funds were transferred. View the record in Activity.');
    navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  };
  const reconcile = async () => {
    const { data } = await qrAPI.getRequest(requestId);
    if (data.paymentRequest?.status === 'completed' && data.transaction) {
      completed(data.transaction);
      return true;
    }
    if (['expired', 'cancelled', 'failed'].includes(data.paymentRequest?.status)) {
      setUncertain(false);
      throw new Error(`This request is ${data.paymentRequest.status}. No further payment can be submitted.`);
    }
    return false;
  };
  const verifyOTP = async () => {
    if (busy.current) return;
    if (!requestId || !receiverCard?.id || !sessionId) {
      toastService.error('Review required', 'Return to the payment request and select a test card.');
      return;
    }
    if (!verified.current && !/^\d{6}$/.test(otp.join(''))) {
      toastService.error('Check code', 'Enter the complete six-digit verification code.');
      return;
    }
    busy.current = true;
    setIsLoading(true);
    try {
      if (uncertain && await reconcile()) return;
      if (!verified.current) {
        const { data } = await otpAPI.verifyOTP(sessionId, otp.join(''));
        if (!data.success) throw new Error('Verification was not accepted.');
        verified.current = true;
      }
      try {
        const { data } = await qrAPI.confirmPayment({ requestId, cardId: receiverCard.id,
          sessionId, idempotencyKey: idempotencyKey.current });
        if (data.simulated !== true) throw new Error('Unexpected payment response. Check request status.');
        completed(data.transaction);
      } catch (error) {
        if (!error.isNetworkError) throw error;
        setUncertain(true);
        try { if (await reconcile()) return; } catch { /* Keep unknown until a later authoritative response. */ }
        toastService.info('Checking payment status', 'The connection was interrupted. Check status before starting another payment.');
      }
    } catch (error) {
      if (typeof error.response?.data?.attemptsLeft === 'number') setAttemptsLeft(error.response.data.attemptsLeft);
      toastService.error(uncertain ? 'Status unavailable' : 'Verification not completed', error.message);
    } finally {
      busy.current = false;
      setIsLoading(false);
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

          <Text style={styles.title}>Verify simulated payment</Text>
          {provider === 'mock' && <Text style={styles.subtitle}>Local demo inbox — no SMS is sent. No real funds are transferred.</Text>}
          <Text style={styles.subtitle}>
            Verification destination:{'\n'}
            <Text style={styles.phoneNumber}>{maskedDestination}</Text>
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
            disabled={!canResend || isLoading || uncertain}
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
            disabled={(!isOtpComplete && !uncertain) || isLoading || (timeLeft === 0 && !uncertain)}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.verifyButtonText}>{uncertain ? 'Check payment status' : 'Verify code'}</Text>
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
