import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Text,
  ActivityIndicator,
  Divider,
  Avatar,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { qrAPI } from '../../config/api';
import toastService from '../../services/toastService';
import { theme, colors, spacing, typography } from '../../styles/theme';

export default function PaymentConfirmScreen({ route, navigation }) {
  const { paymentRequest, receiverCard } = route.params;
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleConfirmPayment = async () => {
    setShowConfirmDialog(true);
  };

  const confirmPayment = () => {
    setShowConfirmDialog(false);
    // Navigate directly to OTP verification
    navigation.navigate('OTPVerification', {
      phoneNumber: '+264816294914', // Verified Twilio number
      purpose: 'payment_verification',
      paymentRequest: paymentRequest,
      receiverCard: receiverCard,
    });
  };

  const cancelPayment = () => {
    setShowConfirmDialog(false);
  };

  const processPayment = async (sessionId) => {
    setIsProcessing(true);
    try {
      const response = await qrAPI.confirmPayment({
        requestId: paymentRequest.id,
        receiverCardId: receiverCard.id,
        sessionId: sessionId, // Include OTP session ID
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
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getExpiryStatus = (expiresAt) => {
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiryDate - now;
    const diffMins = Math.ceil(diffMs / (1000 * 60));
    
    if (diffMins <= 0) return { status: 'expired', color: colors.error };
    if (diffMins <= 2) return { status: 'expiring', color: colors.warning };
    return { status: 'valid', color: colors.success };
  };

  const expiryStatus = getExpiryStatus(paymentRequest.expiresAt);

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Header */}
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <Title style={styles.headerTitle}>Confirm Payment</Title>
            <Paragraph style={styles.headerSubtitle}>
              Review and confirm your payment details
            </Paragraph>
          </View>
        </LinearGradient>

      <View style={styles.content}>
        {/* Payment Request Details */}
        <Card style={styles.detailsCard}>
          <Card.Content>
            <Title style={styles.cardTitle}>Payment Request</Title>
            
            <View style={styles.senderInfo}>
              <Avatar.Text
                size={50}
                label={paymentRequest.senderName.split(' ').map(n => n[0]).join('')}
                style={styles.senderAvatar}
              />
              <View style={styles.senderDetails}>
                <Text style={styles.senderName}>{paymentRequest.senderName}</Text>
                <Text style={styles.senderLabel}>Requesting payment</Text>
              </View>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.amountSection}>
              <Text style={styles.amountLabel}>Amount to Pay</Text>
              <Text style={styles.amountValue}>
                N$ {paymentRequest.amount.toFixed(2)}
              </Text>
            </View>

            {paymentRequest.description && (
              <>
                <Divider style={styles.divider} />
                <View style={styles.descriptionSection}>
                  <Text style={styles.descriptionLabel}>Description</Text>
                  <Text style={styles.descriptionValue}>
                    {paymentRequest.description}
                  </Text>
                </View>
              </>
            )}

            <Divider style={styles.divider} />

            <View style={styles.expirySection}>
              <View style={styles.expiryInfo}>
                <Text style={styles.expiryLabel}>Expires</Text>
                <Text style={[styles.expiryValue, { color: expiryStatus.color }]}>
                  {formatDate(paymentRequest.expiresAt)}
                </Text>
              </View>
              <View style={[styles.expiryBadge, { backgroundColor: expiryStatus.color }]}>
                <Text style={styles.expiryBadgeText}>
                  {expiryStatus.status.toUpperCase()}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Payment Method */}
        <Card style={styles.paymentCard}>
          <Card.Content>
            <Title style={styles.cardTitle}>Payment Method</Title>
            
            <View style={styles.cardInfo}>
              <View style={styles.cardIcon}>
                <Ionicons 
                  name={receiverCard.brand === 'Visa' ? 'card' : 'card-outline'} 
                  size={24} 
                  color={colors.primary} 
                />
              </View>
              <View style={styles.cardDetails}>
                <Text style={styles.cardBrand}>{receiverCard.brand}</Text>
                <Text style={styles.cardNumber}>**** **** **** {receiverCard.last4}</Text>
                <Text style={styles.cardBank}>{receiverCard.bank}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Payment Summary */}
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Title style={styles.cardTitle}>Payment Summary</Title>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount</Text>
              <Text style={styles.summaryValue}>
                N$ {paymentRequest.amount.toFixed(2)}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Fee</Text>
              <Text style={styles.summaryValue}>N$ 0.00</Text>
            </View>

            <Divider style={styles.summaryDivider} />

            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>
                N$ {paymentRequest.amount.toFixed(2)}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            mode="outlined"
            onPress={() => navigation.goBack()}
            style={styles.cancelButton}
            contentStyle={styles.cancelButtonContent}
            disabled={isProcessing}
            theme={{
              colors: {
                primary: colors.error,
              },
            }}
            textColor={colors.error}
          >
            Cancel
          </Button>

          <Button
            mode="contained"
            onPress={handleConfirmPayment}
            loading={isProcessing}
            disabled={isProcessing || expiryStatus.status === 'expired'}
            style={styles.confirmButton}
            contentStyle={styles.confirmButtonContent}
            theme={{
              colors: {
                primary: colors.primary,
              },
            }}
          >
            {isProcessing ? 'Processing...' : 'Confirm Payment'}
          </Button>
        </View>

      </View>
    </ScrollView>

      {/* Custom Confirmation Dialog */}
      {showConfirmDialog && (
        <View style={styles.overlay}>
          <View style={styles.confirmationDialog}>
            <Text style={styles.dialogTitle}>Confirm Payment</Text>
            <Text style={styles.dialogMessage}>
              Are you sure you want to pay N$ {paymentRequest.amount.toFixed(2)} to {paymentRequest.senderName}?
            </Text>
            <View style={styles.dialogButtons}>
              <Button
                mode="outlined"
                onPress={cancelPayment}
                style={styles.cancelButton}
                contentStyle={styles.cancelButtonContent}
                textColor={colors.error}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={confirmPayment}
                style={styles.confirmButton}
                contentStyle={styles.confirmButtonContent}
                buttonColor={colors.primary}
                textColor={colors.white}
              >
                Confirm
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
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
  detailsCard: {
    elevation: 4,
    borderRadius: 12,
    marginBottom: spacing.lg,
  },
  paymentCard: {
    elevation: 4,
    borderRadius: 12,
    marginBottom: spacing.lg,
  },
  summaryCard: {
    elevation: 4,
    borderRadius: 12,
    marginBottom: spacing.lg,
  },
  securityCard: {
    elevation: 2,
    borderRadius: 12,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: typography.h4.fontSize,
    fontWeight: typography.h4.fontWeight,
    color: colors.text,
    marginBottom: spacing.md,
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  senderAvatar: {
    backgroundColor: colors.primary,
    marginRight: spacing.md,
  },
  senderDetails: {
    flex: 1,
  },
  senderName: {
    fontSize: typography.body1.fontSize,
    fontWeight: '600',
    color: colors.text,
  },
  senderLabel: {
    fontSize: typography.caption.fontSize,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  divider: {
    marginVertical: spacing.md,
  },
  amountSection: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  amountLabel: {
    fontSize: typography.body2.fontSize,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
  },
  descriptionSection: {
    paddingVertical: spacing.sm,
  },
  descriptionLabel: {
    fontSize: typography.body2.fontSize,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  descriptionValue: {
    fontSize: typography.body1.fontSize,
    color: colors.text,
  },
  expirySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expiryInfo: {
    flex: 1,
  },
  expiryLabel: {
    fontSize: typography.body2.fontSize,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  expiryValue: {
    fontSize: typography.body1.fontSize,
    fontWeight: '600',
  },
  expiryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  expiryBadgeText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: colors.white,
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  cardDetails: {
    flex: 1,
  },
  cardBrand: {
    fontSize: typography.body1.fontSize,
    fontWeight: '600',
    color: colors.text,
  },
  cardNumber: {
    fontSize: typography.body2.fontSize,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  cardBank: {
    fontSize: typography.caption.fontSize,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  summaryLabel: {
    fontSize: typography.body2.fontSize,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: typography.body2.fontSize,
    color: colors.text,
    fontWeight: '500',
  },
  summaryDivider: {
    marginVertical: spacing.sm,
  },
  totalLabel: {
    fontSize: typography.body1.fontSize,
    fontWeight: '600',
    color: colors.text,
  },
  totalValue: {
    fontSize: typography.body1.fontSize,
    fontWeight: '600',
    color: colors.primary,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  cancelButton: {
    flex: 0.48,
    borderColor: colors.error,
    borderWidth: 1,
    borderRadius: 28,
  },
  confirmButton: {
    flex: 0.48,
  },
  buttonContent: {
    paddingVertical: spacing.sm,
  },
  confirmButtonContent: {
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  cancelButtonContent: {
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  securityTitle: {
    fontSize: typography.body1.fontSize,
    fontWeight: '600',
    color: colors.text,
    marginLeft: spacing.sm,
  },
  securityText: {
    fontSize: typography.caption.fontSize,
    color: colors.textSecondary,
    lineHeight: typography.caption.lineHeight,
  },
  // Custom Dialog Styles
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  confirmationDialog: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.lg,
    margin: spacing.lg,
    minWidth: 280,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  dialogMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
    lineHeight: 22,
  },
  dialogButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  confirmButton: {
    flex: 1,
  },
});