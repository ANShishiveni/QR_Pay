import React, { useState, useEffect } from 'react';
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
  List,
  Divider,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { paymentAPI } from '../../config/api';
import { 
  validateCard, 
  formatCardNumber, 
  getMaxCardNumberLength,
  getCardType 
} from '../../utils/cardValidation';
import { theme, colors, spacing, typography } from '../../styles/theme';
import toastService from '../../services/toastService';

export default function CardsScreen({ navigation }) {
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCard, setNewCard] = useState({
    cardNumber: '',
    expMonth: '',
    expYear: '',
    cvc: '',
    cardholderName: '',
  });

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    try {
      const response = await paymentAPI.getCards();
      setCards(response.data.cards);
    } catch (error) {
      console.error('Error loading cards:', error);
      toastService.error('Error', 'Failed to load cards');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCard = async () => {
    if (!validateCardForm()) return;

    setIsAddingCard(true);
    try {
      await paymentAPI.addCard(newCard);
      setShowAddCardModal(false);
      setNewCard({
        cardNumber: '',
        expMonth: '',
        expYear: '',
        cvc: '',
        cardholderName: '',
      });
      await loadCards();
      toastService.success('Success', 'Card added successfully!');
    } catch (error) {
      console.error('Add card error:', error);
      toastService.error('Error', error.response?.data?.error || 'Failed to add card');
    } finally {
      setIsAddingCard(false);
    }
  };

  const validateCardForm = () => {
    const validation = validateCard(newCard);
    
    if (!validation.isValid) {
      toastService.error('Validation Error', validation.errors.join('\n'));
      return false;
    }

    return true;
  };

  const handleCardNumberChange = (value) => {
    // Remove all non-numeric characters
    const cleanValue = value.replace(/\D/g, '');
    
    // Get maximum allowed length based on current input
    const maxLength = getMaxCardNumberLength(cleanValue);
    
    // Limit input to maximum allowed length
    if (cleanValue.length <= maxLength) {
      // Format the card number with spaces
      const formatted = formatCardNumber(cleanValue);
      setNewCard({ ...newCard, cardNumber: formatted });
    }
  };

  const handleCVCChange = (value) => {
    // Remove all non-numeric characters and limit to 4 digits
    const cleanValue = value.replace(/\D/g, '').slice(0, 4);
    setNewCard({ ...newCard, cvc: cleanValue });
  };

  const handleExpiryMonthChange = (value) => {
    // Remove all non-numeric characters and limit to 2 digits
    const cleanValue = value.replace(/\D/g, '').slice(0, 2);
    setNewCard({ ...newCard, expMonth: cleanValue });
  };

  const handleExpiryYearChange = (value) => {
    // Remove all non-numeric characters and limit to 4 digits
    const cleanValue = value.replace(/\D/g, '').slice(0, 4);
    setNewCard({ ...newCard, expYear: cleanValue });
  };

  const handleSetDefault = async (cardId) => {
    try {
      await paymentAPI.setDefaultCard(cardId);
      await loadCards();
      toastService.success('Success', 'Default card updated successfully!');
    } catch (error) {
      console.error('Set default card error:', error);
      toastService.error('Error', 'Failed to update default card');
    }
  };

  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [cardToRemove, setCardToRemove] = useState(null);

  const handleRemoveCard = (cardId, cardInfo) => {
    setCardToRemove({ id: cardId, info: cardInfo });
    setShowRemoveConfirm(true);
  };

  const cancelRemove = () => {
    setShowRemoveConfirm(false);
    setCardToRemove(null);
  };

  const confirmRemoveCard = async () => {
    if (!cardToRemove) return;
    
    setShowRemoveConfirm(false);
    try {
      await paymentAPI.removeCard(cardToRemove.id);
      await loadCards();
      toastService.success('Success', 'Card removed successfully!');
    } catch (error) {
      console.error('Remove card error:', error);
      toastService.error('Error', 'Failed to remove card');
    } finally {
      setCardToRemove(null);
    }
  };

  const getCardIcon = (brand) => {
    switch (brand.toLowerCase()) {
      case 'visa':
        return 'card';
      case 'mastercard':
        return 'card';
      case 'amex':
        return 'card';
      default:
        return 'card-outline';
    }
  };

  const getBankColor = (bank) => {
    switch (bank) {
      case 'FNB':
        return '#1E3A8A';
      case 'Standard Bank':
        return '#059669';
      case 'Bank Windhoek':
        return '#DC2626';
      case 'Nedbank':
        return '#7C3AED';
      default:
        return colors.primary;
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading cards...</Text>
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
          <Title style={styles.headerTitle}>My Cards</Title>
          <Paragraph style={styles.headerSubtitle}>
            Manage your payment cards
          </Paragraph>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* Add Card Button */}
        <Button
          mode="contained"
          onPress={() => setShowAddCardModal(true)}
          style={styles.addCardButton}
          icon="plus"
          theme={{
            colors: {
              primary: colors.primary,
            },
          }}
        >
          Add New Card
        </Button>

        {/* Cards List */}
        {cards.length > 0 ? (
          <View style={styles.cardsList}>
            {cards.map((card, index) => (
              <Card key={card.id} style={styles.cardItem}>
                <Card.Content>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardInfo}>
                      <View style={styles.cardIcon}>
                        <Ionicons 
                          name={getCardIcon(card.brand)} 
                          size={24} 
                          color={getBankColor(card.bank)} 
                        />
                      </View>
                      <View style={styles.cardDetails}>
                        <Text style={styles.cardBrand}>{card.brand}</Text>
                        <Text style={styles.cardNumber}>**** **** **** {card.last4}</Text>
                        <Text style={styles.cardBank}>{card.bank}</Text>
                      </View>
                    </View>
                    {card.isDefault && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultText}>DEFAULT</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardActions}>
                    {!card.isDefault && (
                      <Button
                        mode="outlined"
                        onPress={() => handleSetDefault(card.id)}
                        style={styles.actionButton}
                        compact
                        theme={{
                          colors: {
                            primary: colors.primary,
                          },
                        }}
                      >
                        Set Default
                      </Button>
                    )}
                    <Button
                      mode="outlined"
                      onPress={() => handleRemoveCard(card.id, card)}
                      style={[styles.actionButton, styles.removeButton]}
                      compact
                      textColor={colors.error}
                      theme={{
                        colors: {
                          primary: colors.error,
                        },
                      }}
                    >
                      Remove
                    </Button>
                  </View>
                </Card.Content>
              </Card>
            ))}
          </View>
        ) : (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <Ionicons name="card-outline" size={64} color={colors.gray} />
              <Title style={styles.emptyTitle}>No Cards Added</Title>
              <Paragraph style={styles.emptySubtitle}>
                Add a payment card to start making transactions
              </Paragraph>
            </Card.Content>
          </Card>
        )}

        {/* Test Cards Info */}
        <Card style={styles.testCard}>
          <Card.Content>
            <Title style={styles.testTitle}>Test Cards</Title>
            <Paragraph style={styles.testText}>
              For testing purposes, you can use these test card numbers:
            </Paragraph>
            <View style={styles.testCardsList}>
              <Text style={styles.testCardItem}>• FNB: 4242424242424242</Text>
              <Text style={styles.testCardItem}>• Standard Bank: 4000056655665556</Text>
              <Text style={styles.testCardItem}>• Bank Windhoek: 5555555555554444</Text>
              <Text style={styles.testCardItem}>• Nedbank: 2223003122003222</Text>
            </View>
            <Paragraph style={styles.testNote}>
              Use any future expiry date and any 3-digit CVC.
            </Paragraph>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Add Card Modal */}
      <Modal
        visible={showAddCardModal}
        onDismiss={() => setShowAddCardModal(false)}
        contentContainerStyle={styles.modalContainer}
      >
        <Card style={styles.modalCard}>
          <Card.Content>
            <Title style={styles.modalTitle}>Add New Card</Title>
            
            <TextInput
              label="Card Number"
              value={newCard.cardNumber}
              onChangeText={handleCardNumberChange}
              mode="outlined"
              keyboardType="numeric"
              placeholder="1234 5678 9012 3456"
              style={styles.modalInput}
              maxLength={23} // Maximum formatted length (19 digits + 4 spaces)
              theme={{
                colors: {
                  primary: colors.primary,
                },
              }}
            />

            <View style={styles.expiryRow}>
              <TextInput
                label="Month"
                value={newCard.expMonth}
                onChangeText={handleExpiryMonthChange}
                mode="outlined"
                keyboardType="numeric"
                placeholder="MM"
                style={[styles.modalInput, styles.halfInput]}
                maxLength={2}
                theme={{
                  colors: {
                    primary: colors.primary,
                  },
                }}
              />
              <TextInput
                label="Year"
                value={newCard.expYear}
                onChangeText={handleExpiryYearChange}
                mode="outlined"
                keyboardType="numeric"
                placeholder="YYYY"
                style={[styles.modalInput, styles.halfInput]}
                maxLength={4}
                theme={{
                  colors: {
                    primary: colors.primary,
                  },
                }}
              />
            </View>

            <TextInput
              label="CVC"
              value={newCard.cvc}
              onChangeText={handleCVCChange}
              mode="outlined"
              keyboardType="numeric"
              placeholder="123"
              style={styles.modalInput}
              maxLength={4}
              theme={{
                colors: {
                  primary: colors.primary,
                },
              }}
            />

            <TextInput
              label="Cardholder Name"
              value={newCard.cardholderName}
              onChangeText={(value) => setNewCard({ ...newCard, cardholderName: value })}
              mode="outlined"
              placeholder="John Doe"
              style={styles.modalInput}
              theme={{
                colors: {
                  primary: colors.primary,
                },
              }}
            />

            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setShowAddCardModal(false)}
                style={styles.modalButton}
                theme={{
                  colors: {
                    primary: colors.primary,
                  },
                }}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleAddCard}
                loading={isAddingCard}
                disabled={isAddingCard}
                style={styles.modalButton}
                theme={{
                  colors: {
                    primary: colors.primary,
                  },
                }}
              >
                Add Card
              </Button>
            </View>
          </Card.Content>
        </Card>
      </Modal>

      {/* Custom Remove Confirmation Dialog */}
      {showRemoveConfirm && cardToRemove && (
        <View style={styles.overlay}>
          <View style={styles.confirmationDialog}>
            <Text style={styles.dialogTitle}>Remove Card</Text>
            <Text style={styles.dialogMessage}>
              Are you sure you want to remove the {cardToRemove.info.brand} card ending in {cardToRemove.info.last4}?
            </Text>
            <View style={styles.dialogButtons}>
              <Button
                mode="outlined"
                onPress={cancelRemove}
                style={styles.cancelButton}
                textColor={colors.textSecondary}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={confirmRemoveCard}
                style={styles.removeDialogButton}
                buttonColor={colors.error}
                textColor={colors.white}
              >
                Remove
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.body1.fontSize,
    color: colors.textSecondary,
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
    flex: 1,
    padding: spacing.lg,
  },
  addCardButton: {
    marginBottom: spacing.lg,
  },
  cardsList: {
    marginBottom: spacing.lg,
  },
  cardItem: {
    elevation: 4,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
  defaultBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  defaultText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    color: colors.white,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    marginLeft: spacing.sm,
  },
  removeButton: {
    borderColor: colors.error,
  },
  emptyCard: {
    elevation: 2,
    borderRadius: 12,
    marginBottom: spacing.lg,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
    color: colors.text,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: typography.body2.fontSize,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  testCard: {
    elevation: 2,
    borderRadius: 12,
    backgroundColor: colors.info + '10',
  },
  testTitle: {
    fontSize: typography.h4.fontSize,
    fontWeight: typography.h4.fontWeight,
    color: colors.info,
    marginBottom: spacing.sm,
  },
  testText: {
    fontSize: typography.body2.fontSize,
    color: colors.text,
    marginBottom: spacing.md,
  },
  testCardsList: {
    marginBottom: spacing.md,
  },
  testCardItem: {
    fontSize: typography.body2.fontSize,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  testNote: {
    fontSize: typography.caption.fontSize,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  modalContainer: {
    padding: spacing.lg,
  },
  modalCard: {
    elevation: 8,
    borderRadius: 16,
  },
  modalTitle: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
    color: colors.text,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  modalInput: {
    marginBottom: spacing.md,
  },
  expiryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    flex: 0.48,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  modalButton: {
    flex: 0.48,
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
    zIndex: 2000,
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
  cancelButton: {
    flex: 1,
    borderColor: colors.border,
  },
  removeDialogButton: {
    flex: 1,
  },
});