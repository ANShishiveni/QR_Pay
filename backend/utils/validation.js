const validator = require('validator');

// Email validation
const isValidEmail = (email) => {
  return validator.isEmail(email);
};

// Password validation
const isValidPassword = (password) => {
  return password && password.length >= 6;
};

// Card number validation (basic Luhn algorithm)
const isValidCardNumber = (cardNumber) => {
  const cleaned = cardNumber.replace(/\D/g, '');
  if (cleaned.length < 13 || cleaned.length > 19) return false;
  
  let sum = 0;
  let isEven = false;
  
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i]);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
};

// CVC validation
const isValidCVC = (cvc) => {
  const cleaned = cvc.replace(/\D/g, '');
  return cleaned.length >= 3 && cleaned.length <= 4;
};

// Expiry date validation
const isValidExpiryDate = (month, year) => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  
  const expMonth = parseInt(month);
  const expYear = parseInt(year);
  
  if (expMonth < 1 || expMonth > 12) return false;
  if (expYear < currentYear) return false;
  if (expYear === currentYear && expMonth < currentMonth) return false;
  
  return true;
};

// Amount validation
const isValidAmount = (amount) => {
  const numAmount = parseFloat(amount);
  return !isNaN(numAmount) && numAmount > 0 && numAmount <= 100000; // Max N$100,000
};

// Phone number validation (Namibian format)
const isValidPhoneNumber = (phone) => {
  if (!phone) return true; // Optional field
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
};

// Name validation
const isValidName = (name) => {
  return name && name.trim().length >= 2 && name.trim().length <= 50;
};

// Validation middleware factory
const createValidationMiddleware = (rules) => {
  return (req, res, next) => {
    const errors = [];
    
    for (const [field, validators] of Object.entries(rules)) {
      const value = req.body[field];
      
      for (const validator of validators) {
        if (!validator.fn(value)) {
          errors.push({
            field,
            message: validator.message
          });
          break; // Only show first error per field
        }
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }
    
    next();
  };
};

module.exports = {
  isValidEmail,
  isValidPassword,
  isValidCardNumber,
  isValidCVC,
  isValidExpiryDate,
  isValidAmount,
  isValidPhoneNumber,
  isValidName,
  createValidationMiddleware
};