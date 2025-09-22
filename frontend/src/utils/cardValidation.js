// Card validation utilities for global card number standards
export const CARD_TYPES = {
  VISA: {
    name: 'Visa',
    pattern: /^4/,
    lengths: [13, 16, 19], // Visa can be 13, 16, or 19 digits
    maxLength: 19
  },
  MASTERCARD: {
    name: 'Mastercard',
    pattern: /^5[1-5]|^2[2-7]/,
    lengths: [16],
    maxLength: 16
  },
  AMERICAN_EXPRESS: {
    name: 'American Express',
    pattern: /^3[47]/,
    lengths: [15],
    maxLength: 15
  },
  DISCOVER: {
    name: 'Discover',
    pattern: /^6(?:011|5)/,
    lengths: [16],
    maxLength: 16
  },
  DINERS_CLUB: {
    name: 'Diners Club',
    pattern: /^3[0689]/,
    lengths: [14],
    maxLength: 14
  },
  JCB: {
    name: 'JCB',
    pattern: /^35/,
    lengths: [15, 16],
    maxLength: 16
  },
  UNIONPAY: {
    name: 'UnionPay',
    pattern: /^62/,
    lengths: [16, 17, 18, 19],
    maxLength: 19
  }
};

// Get card type from number
export const getCardType = (cardNumber) => {
  const cleanNumber = cardNumber.replace(/\s/g, '');
  
  for (const [type, config] of Object.entries(CARD_TYPES)) {
    if (config.pattern.test(cleanNumber)) {
      return { type, ...config };
    }
  }
  
  return null;
};

// Validate card number length based on card type
export const validateCardNumberLength = (cardNumber) => {
  const cleanNumber = cardNumber.replace(/\s/g, '');
  const cardType = getCardType(cleanNumber);
  
  if (!cardType) {
    return {
      isValid: false,
      error: 'Unsupported card type',
      maxLength: 19 // Default to maximum possible length
    };
  }
  
  const isValidLength = cardType.lengths.includes(cleanNumber.length);
  
  return {
    isValid: isValidLength,
    error: isValidLength ? null : `Invalid ${cardType.name} card number length`,
    cardType: cardType.name,
    maxLength: cardType.maxLength,
    expectedLengths: cardType.lengths
  };
};

// Format card number with spaces
export const formatCardNumber = (cardNumber) => {
  const cleanNumber = cardNumber.replace(/\s/g, '');
  const cardType = getCardType(cleanNumber);
  
  if (!cardType) {
    // Default formatting for unknown cards (every 4 digits)
    return cleanNumber.replace(/(.{4})/g, '$1 ').trim();
  }
  
  // Different formatting based on card type
  if (cardType.name === 'American Express') {
    // Amex: XXXX XXXXXX XXXXX
    return cleanNumber.replace(/(.{4})(.{6})(.{5})/, '$1 $2 $3').trim();
  } else if (cardType.name === 'Diners Club') {
    // Diners: XXXX XXXXXX XXXX
    return cleanNumber.replace(/(.{4})(.{6})(.{4})/, '$1 $2 $3').trim();
  } else {
    // Visa, Mastercard, Discover, JCB, UnionPay: XXXX XXXX XXXX XXXX
    return cleanNumber.replace(/(.{4})/g, '$1 ').trim();
  }
};

// Validate CVC based on card type
export const validateCVC = (cvc, cardNumber) => {
  const cleanNumber = cardNumber.replace(/\s/g, '');
  const cardType = getCardType(cleanNumber);
  
  if (!cardType) {
    return {
      isValid: cvc.length >= 3 && cvc.length <= 4,
      error: 'Invalid CVC length',
      expectedLength: '3-4 digits'
    };
  }
  
  const expectedLength = cardType.name === 'American Express' ? 4 : 3;
  const isValid = cvc.length === expectedLength;
  
  return {
    isValid,
    error: isValid ? null : `${cardType.name} CVC must be ${expectedLength} digits`,
    expectedLength: `${expectedLength} digits`
  };
};

// Validate expiry date
export const validateExpiryDate = (month, year) => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  
  const expMonth = parseInt(month);
  const expYear = parseInt(year);
  
  if (expMonth < 1 || expMonth > 12) {
    return {
      isValid: false,
      error: 'Invalid month (must be 01-12)'
    };
  }
  
  if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
    return {
      isValid: false,
      error: 'Card has expired'
    };
  }
  
  return {
    isValid: true,
    error: null
  };
};

// Complete card validation
export const validateCard = (cardData) => {
  const { cardNumber, expMonth, expYear, cvc, cardholderName } = cardData;
  const errors = [];
  
  // Validate card number
  const cardValidation = validateCardNumberLength(cardNumber);
  if (!cardValidation.isValid) {
    errors.push(cardValidation.error);
  }
  
  // Validate CVC
  const cvcValidation = validateCVC(cvc, cardNumber);
  if (!cvcValidation.isValid) {
    errors.push(cvcValidation.error);
  }
  
  // Validate expiry date
  const expiryValidation = validateExpiryDate(expMonth, expYear);
  if (!expiryValidation.isValid) {
    errors.push(expiryValidation.error);
  }
  
  // Validate cardholder name
  if (!cardholderName || cardholderName.trim().length < 2) {
    errors.push('Cardholder name must be at least 2 characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    cardType: cardValidation.cardType,
    maxLength: cardValidation.maxLength
  };
};

// Get maximum allowed length for input
export const getMaxCardNumberLength = (cardNumber) => {
  const cleanNumber = cardNumber.replace(/\s/g, '');
  const cardType = getCardType(cleanNumber);
  
  if (cardType) {
    return cardType.maxLength;
  }
  
  // Return maximum possible length for unknown cards
  return 19;
};
