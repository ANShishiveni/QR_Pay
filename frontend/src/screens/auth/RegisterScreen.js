import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import {
  TextInput,
  Button,
  Card,
  Title,
  Paragraph,
  Text,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { authAPI } from '../../config/api';
import { theme, colors, spacing, typography } from '../../styles/theme';
import toastService from '../../services/toastService';
import { useAuth } from '../../context/AuthContext';

export default function RegisterScreen({ navigation }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { login } = useAuth();

  const handleInputChange = (field, value) => {
    // Limit phone number length to prevent excessive input
    if (field === 'phoneNumber' && value.length > 13) {
      toastService.error('Phone Number Too Long', 'Please enter a valid phone number (max 13 digits)');
      return;
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const { firstName, lastName, email, password, confirmPassword, phoneNumber } = formData;

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      toastService.error('Validation Error', 'Please fill in all fields');
      return false;
    }

    if (password !== confirmPassword) {
      toastService.error('Validation Error', 'Passwords do not match');
      return false;
    }

    if (password.length < 6) {
      toastService.error('Validation Error', 'Password must be at least 6 characters long');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toastService.error('Validation Error', 'Please enter a valid email address');
      return false;
    }

    // Validate phone number if provided
    if (phoneNumber && phoneNumber.trim()) {
      // Remove all non-digit characters for validation
      const digitsOnly = phoneNumber.replace(/\D/g, '');
      
      // Check if phone number has reasonable length (7-15 digits)
      if (digitsOnly.length < 7) {
        toastService.error('Validation Error', 'Phone number must be at least 7 digits');
        return false;
      }
      
      if (digitsOnly.length > 15) {
        toastService.error('Validation Error', 'Phone number cannot exceed 15 digits');
        return false;
      }
    }

    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      console.log('🎯 Starting registration with data:', { ...formData, password: '[HIDDEN]' });
      
      const { confirmPassword, ...registrationData } = formData;
      console.log('📤 Sending registration request to API...');
      console.log('📋 Registration data:', registrationData);
      
      const response = await authAPI.register(registrationData);
      console.log('✅ Registration response:', response.data);
      
      const { token, user } = response.data;

      // Use AuthContext to handle login
      await login(token, user);
      console.log('Auth data stored successfully');

      // Show success message
      console.log('🎉 Registration successful! Navigating to home...');
      
      toastService.success('Account Created!', 'Registration successful');
    } catch (error) {
      console.error('❌ Registration error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config,
        stack: error.stack
      });
      
      // Show error message
      const errorMessage = error.response?.data?.error || error.message || 'An error occurred during registration';
      console.error('❌ Registration failed:', errorMessage);
      
      toastService.error('Registration Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[colors.primary, colors.primaryDark]}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Title style={styles.title}>Create Account</Title>
            <Paragraph style={styles.subtitle}>
              Join the future of mobile payments
            </Paragraph>
          </View>

          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.nameRow}>
                <TextInput
                  label="First Name"
                  value={formData.firstName}
                  onChangeText={(value) => handleInputChange('firstName', value)}
                  mode="outlined"
                  style={[styles.input, styles.halfInput]}
                  theme={{
                    colors: {
                      primary: colors.primary,
                    },
                  }}
                />
                <TextInput
                  label="Last Name"
                  value={formData.lastName}
                  onChangeText={(value) => handleInputChange('lastName', value)}
                  mode="outlined"
                  style={[styles.input, styles.halfInput]}
                  theme={{
                    colors: {
                      primary: colors.primary,
                    },
                  }}
                />
              </View>

              <TextInput
                label="Email"
                value={formData.email}
                onChangeText={(value) => handleInputChange('email', value)}
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                style={styles.input}
                theme={{
                  colors: {
                    primary: colors.primary,
                  },
                }}
              />

              <TextInput
                label="Phone Number"
                value={formData.phoneNumber}
                onChangeText={(value) => handleInputChange('phoneNumber', value)}
                mode="outlined"
                keyboardType="phone-pad"
                maxLength={13}
                placeholder="e.g., +264 81 234 567"
                style={styles.input}
                theme={{
                  colors: {
                    primary: colors.primary,
                  },
                }}
              />

              <TextInput
                label="Password"
                value={formData.password}
                onChangeText={(value) => handleInputChange('password', value)}
                mode="outlined"
                secureTextEntry={!showPassword}
                autoComplete="password"
                style={styles.input}
                right={
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={24}
                    color={colors.primary}
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.iconButton}
                  />
                }
                theme={{
                  colors: {
                    primary: colors.primary,
                  },
                }}
              />

              <TextInput
                label="Confirm Password"
                value={formData.confirmPassword}
                onChangeText={(value) => handleInputChange('confirmPassword', value)}
                mode="outlined"
                secureTextEntry={!showConfirmPassword}
                autoComplete="password"
                style={styles.input}
                right={
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off' : 'eye'}
                    size={24}
                    color={colors.primary}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.iconButton}
                  />
                }
                theme={{
                  colors: {
                    primary: colors.primary,
                  },
                }}
              />

              <Button
                mode="contained"
                onPress={handleRegister}
                loading={isLoading}
                disabled={isLoading}
                style={styles.registerButton}
                contentStyle={styles.buttonContent}
                theme={{
                  colors: {
                    primary: colors.primary,
                  },
                }}
              >
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Button>

              <View style={styles.loginContainer}>
                <Text style={styles.loginText}>Already have an account? </Text>
                <Button
                  mode="text"
                  onPress={() => navigation.navigate('Login')}
                  labelStyle={styles.loginButton}
                >
                  Sign In
                </Button>
              </View>
            </Card.Content>
          </Card>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By creating an account, you agree to our Terms of Service and Privacy Policy.
              This is a prototype application for demonstration purposes.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.h1.fontSize,
    fontWeight: typography.h1.fontWeight,
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.body1.fontSize,
    color: colors.white,
    textAlign: 'center',
    opacity: 0.9,
  },
  card: {
    elevation: 8,
    borderRadius: 16,
    marginBottom: spacing.lg,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    flex: 0.48,
  },
  input: {
    marginBottom: spacing.md,
  },
  registerButton: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  buttonContent: {
    paddingVertical: spacing.sm,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: typography.body2.fontSize,
    color: colors.textSecondary,
  },
  loginButton: {
    color: colors.primary,
    fontSize: typography.body2.fontSize,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  footerText: {
    fontSize: typography.caption.fontSize,
    color: colors.white,
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: typography.caption.lineHeight,
  },
  iconButton: {
    padding: 8,
    cursor: 'pointer',
  },
});