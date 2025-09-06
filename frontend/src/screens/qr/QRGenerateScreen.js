import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Share,
  Image,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  TextInput,
  Button,
  Text,
  ActivityIndicator,
  Divider,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { qrAPI } from '../../config/api';
import { theme, colors, spacing, typography } from '../../styles/theme';

export default function QRGenerateScreen({ navigation }) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [qrCodeData, setQrCodeData] = useState(null);
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [qrCodeError, setQrCodeError] = useState(null);

  const handleGenerateQR = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setIsGenerating(true);
    setQrCodeError(null);
    try {
      const response = await qrAPI.generateQR({
        amount: parseFloat(amount),
        description: description || 'QR Payment Request',
        expiresIn: 300, // 5 minutes
      });

      setQrCodeData(response.data.qrCode);
      setPaymentRequest(response.data.paymentRequest);

      Alert.alert(
        'QR Code Generated',
        'Your payment request QR code has been generated successfully!',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Generate QR error:', error);
      setQrCodeError(error.response?.data?.error || 'Failed to generate QR code');
      Alert.alert(
        'Error',
        error.response?.data?.error || 'Failed to generate QR code'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShareQR = async () => {
    if (!qrCodeData) return;

    try {
      await Share.share({
        message: `Payment Request: N$ ${amount}\nDescription: ${description || 'QR Payment Request'}\n\nScan this QR code to pay.`,
        title: 'QR Payment Request',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleReset = () => {
    setAmount('');
    setDescription('');
    setQrCodeData(null);
    setPaymentRequest(null);
    setQrCodeError(null);
  };

  const formatExpiryTime = (expiresAt) => {
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiryDate - now;
    const diffMins = Math.ceil(diffMs / (1000 * 60));
    
    if (diffMins <= 0) return 'Expired';
    return `${diffMins} minutes`;
  };

  return (
    <ScrollView style={styles.container}>
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Ionicons name="qr-code" size={32} color={colors.white} />
          <Title style={styles.headerTitle}>Generate QR Code</Title>
          <Paragraph style={styles.headerSubtitle}>
            Create a payment request QR code
          </Paragraph>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {!qrCodeData ? (
          <Card style={styles.formCard}>
            <Card.Content>
              <Title style={styles.cardTitle}>Payment Request Details</Title>
              <Paragraph style={styles.cardSubtitle}>
                Enter the amount and description for your payment request
              </Paragraph>

              <TextInput
                label="Amount (NAD)"
                value={amount}
                onChangeText={setAmount}
                mode="outlined"
                keyboardType="numeric"
                placeholder="0.00"
                style={styles.input}
                left={<Ionicons name="cash" size={24} color={colors.primary} style={styles.iconButton} />}
                theme={{
                  colors: {
                    primary: colors.primary,
                  },
                }}
              />

              <TextInput
                label="Description (Optional)"
                value={description}
                onChangeText={setDescription}
                mode="outlined"
                placeholder="e.g., Lunch payment, Shared expenses"
                style={styles.input}
                multiline
                numberOfLines={3}
                theme={{
                  colors: {
                    primary: colors.primary,
                  },
                }}
              />

              <Button
                mode="contained"
                onPress={handleGenerateQR}
                loading={isGenerating}
                disabled={isGenerating}
                style={styles.generateButton}
                contentStyle={styles.buttonContent}
                theme={{
                  colors: {
                    primary: colors.primary,
                  },
                }}
              >
                {isGenerating ? 'Generating...' : 'Generate QR Code'}
              </Button>
            </Card.Content>
          </Card>
        ) : (
          <View style={styles.qrContainer}>
            {/* QR Code Display */}
            <Card style={styles.qrCard}>
              <Card.Content style={styles.qrContent}>
                <Title style={styles.qrTitle}>Your Payment Request</Title>
                
                <View style={styles.qrCodeContainer}>
                  {qrCodeError ? (
                    <View style={styles.qrCodeErrorContainer}>
                      <Ionicons name="alert-circle" size={60} color={colors.error} />
                      <Text style={styles.qrCodeErrorText}>Failed to Generate QR Code</Text>
                      <Text style={styles.qrCodeErrorDetails}>{qrCodeError}</Text>
                    </View>
                  ) : qrCodeData ? (
                    <View style={styles.qrCodeImageContainer}>
                      <Image 
                        source={{ uri: qrCodeData }} 
                        style={styles.qrCodeImage}
                        resizeMode="contain"
                      />
                      <Text style={styles.qrCodeText}>QR Code Generated</Text>
                    </View>
                  ) : (
                    <View style={styles.qrCodePlaceholder}>
                      <Ionicons name="qr-code" size={120} color={colors.primary} />
                      <Text style={styles.qrCodeText}>
                        {isGenerating ? 'Generating QR Code...' : 'QR Code will appear here'}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.paymentDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Amount:</Text>
                    <Text style={styles.detailValue}>N$ {parseFloat(amount).toFixed(2)}</Text>
                  </View>
                  
                  {description && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Description:</Text>
                      <Text style={styles.detailValue}>{description}</Text>
                    </View>
                  )}
                  
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Expires in:</Text>
                    <Text style={styles.detailValue}>
                      {formatExpiryTime(paymentRequest.expiresAt)}
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <Button
                mode="outlined"
                onPress={handleShareQR}
                style={styles.actionButton}
                theme={{
                  colors: {
                    primary: colors.primary,
                  },
                }}
              >
                <View style={styles.buttonContent}>
                  <Ionicons name="share" size={20} color={colors.primary} style={styles.buttonIcon} />
                  <Text style={styles.buttonText}>Share QR Code</Text>
                </View>
              </Button>

              <Button
                mode="contained"
                onPress={handleReset}
                style={styles.actionButton}
                theme={{
                  colors: {
                    primary: colors.primary,
                  },
                }}
              >
                <View style={styles.buttonContent}>
                  <Ionicons name="refresh" size={20} color={colors.white} style={styles.buttonIcon} />
                  <Text style={styles.buttonText}>Generate New</Text>
                </View>
              </Button>
            </View>

            {/* Instructions */}
            <Card style={styles.instructionsCard}>
              <Card.Content>
                <Title style={styles.instructionsTitle}>How to use:</Title>
                <View style={styles.instructionItem}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={styles.instructionText}>
                    Show this QR code to the person who needs to pay you
                  </Text>
                </View>
                <View style={styles.instructionItem}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={styles.instructionText}>
                    They can scan it with their phone camera or QR scanner
                  </Text>
                </View>
                <View style={styles.instructionItem}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={styles.instructionText}>
                    The payment will be processed automatically
                  </Text>
                </View>
                <View style={styles.instructionItem}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={styles.instructionText}>
                    You'll receive a notification when payment is complete
                  </Text>
                </View>
              </Card.Content>
            </Card>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  content: {
    padding: spacing.lg,
  },
  formCard: {
    elevation: 4,
    borderRadius: 12,
  },
  cardTitle: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  cardSubtitle: {
    fontSize: typography.body2.fontSize,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  input: {
    marginBottom: spacing.md,
  },
  generateButton: {
    marginTop: spacing.md,
  },
  buttonContent: {
    paddingVertical: spacing.sm,
  },
  qrContainer: {
    alignItems: 'center',
  },
  qrCard: {
    elevation: 4,
    borderRadius: 12,
    width: '100%',
    marginBottom: spacing.lg,
  },
  qrContent: {
    alignItems: 'center',
  },
  qrTitle: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  qrCodeContainer: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: 12,
    marginBottom: spacing.lg,
    elevation: 2,
    alignItems: 'center',
  },
  qrCodePlaceholder: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  qrCodeImageContainer: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  qrCodeImage: {
    width: 250,
    height: 250,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  qrCodeErrorContainer: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  qrCodeErrorText: {
    fontSize: typography.h4.fontSize,
    fontWeight: typography.h4.fontWeight,
    color: colors.error,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  qrCodeErrorDetails: {
    fontSize: typography.body2.fontSize,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  qrCodeText: {
    fontSize: typography.h4.fontSize,
    fontWeight: typography.h4.fontWeight,
    color: colors.primary,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  qrCodeData: {
    fontSize: typography.body2.fontSize,
    color: colors.textSecondary,
    textAlign: 'center',
    fontFamily: 'monospace',
    backgroundColor: colors.lightGray,
    padding: spacing.sm,
    borderRadius: 8,
    marginTop: spacing.sm,
  },
  paymentDetails: {
    width: '100%',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  detailLabel: {
    fontSize: typography.body2.fontSize,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: typography.body2.fontSize,
    color: colors.text,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: spacing.lg,
  },
  actionButton: {
    flex: 0.48,
  },
  instructionsCard: {
    elevation: 2,
    borderRadius: 12,
    width: '100%',
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
  iconButton: {
    padding: 8,
    cursor: 'pointer',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.body1.fontSize,
    fontWeight: '500',
  },
});