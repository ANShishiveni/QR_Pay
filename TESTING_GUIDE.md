# QR Money Transfer - Testing Guide

This guide provides comprehensive testing scenarios for the QR Money Transfer application prototype.

## Test Environment Setup

### Prerequisites
- Backend server running on `http://localhost:3000`
- Frontend app running via Expo
- Firebase project configured
- Stripe test account set up

### Test Data
Use these test card numbers for different "banks":

| Bank | Card Number | CVC | Expiry |
|------|-------------|-----|--------|
| FNB | 4242424242424242 | 123 | 12/2025 |
| Standard Bank | 4000056655665556 | 123 | 12/2025 |
| Bank Windhoek | 5555555555554444 | 123 | 12/2025 |
| Nedbank | 2223003122003222 | 123 | 12/2025 |

## Test Scenarios

### 1. User Registration and Authentication

#### Test Case 1.1: Successful Registration
**Steps:**
1. Open the app
2. Tap "Sign Up"
3. Fill in registration form:
   - First Name: John
   - Last Name: Doe
   - Email: john.doe@test.com
   - Phone: +264811234567
   - Password: password123
   - Confirm Password: password123
4. Tap "Create Account"

**Expected Result:**
- Account created successfully
- User redirected to main app
- Welcome message displayed

#### Test Case 1.2: Registration Validation
**Steps:**
1. Try to register with invalid email
2. Try to register with short password
3. Try to register with mismatched passwords
4. Try to register with empty fields

**Expected Result:**
- Appropriate error messages displayed
- Registration blocked until valid data entered

#### Test Case 1.3: Login
**Steps:**
1. Use registered credentials to log in
2. Test with wrong password
3. Test with non-existent email

**Expected Result:**
- Successful login with correct credentials
- Error messages for invalid credentials

### 2. Card Management

#### Test Case 2.1: Add Card
**Steps:**
1. Go to Profile > My Cards
2. Tap "Add New Card"
3. Fill in card details:
   - Card Number: 4242424242424242
   - Month: 12
   - Year: 2025
   - CVC: 123
   - Cardholder Name: John Doe
4. Tap "Add Card"

**Expected Result:**
- Card added successfully
- Card appears in cards list
- Card shows as FNB bank

#### Test Case 2.2: Set Default Card
**Steps:**
1. Add multiple cards
2. Set one as default
3. Verify default badge appears

**Expected Result:**
- Only one card can be default
- Default badge displayed correctly

#### Test Case 2.3: Remove Card
**Steps:**
1. Add a card
2. Remove the card
3. Confirm removal

**Expected Result:**
- Card removed from list
- Confirmation message displayed

### 3. QR Code Generation

#### Test Case 3.1: Generate Payment Request
**Steps:**
1. Go to QR tab
2. Enter amount: 100.00
3. Enter description: "Test payment"
4. Tap "Generate QR Code"

**Expected Result:**
- QR code generated successfully
- Payment details displayed
- Expiry time shown (5 minutes)

#### Test Case 3.2: Share QR Code
**Steps:**
1. Generate a QR code
2. Tap "Share QR Code"

**Expected Result:**
- Share dialog opens
- QR code data shared

### 4. QR Code Scanning

#### Test Case 4.1: Scan Valid QR Code
**Steps:**
1. Generate QR code on Device A
2. Use Device B to scan the QR code
3. Verify payment details displayed

**Expected Result:**
- QR code scanned successfully
- Payment request details shown
- Proceed to payment confirmation

#### Test Case 4.2: Scan Invalid QR Code
**Steps:**
1. Try to scan a non-payment QR code
2. Try to scan expired QR code

**Expected Result:**
- Error message for invalid QR code
- Error message for expired QR code

### 5. Payment Processing

#### Test Case 5.1: Successful Payment
**Steps:**
1. User A generates QR code for N$50
2. User B scans QR code
3. User B confirms payment with their card
4. Complete payment process

**Expected Result:**
- Payment processed successfully
- Transaction recorded for both users
- Success message displayed

#### Test Case 5.2: Cross-Bank Payment
**Steps:**
1. User A (FNB card) generates QR code
2. User B (Standard Bank card) pays
3. Complete payment

**Expected Result:**
- Cross-bank transfer simulated
- Both banks shown in transaction
- Payment successful

#### Test Case 5.3: Payment with Insufficient Funds
**Steps:**
1. Use a card that would decline
2. Attempt payment

**Expected Result:**
- Payment failure message
- Transaction not recorded

### 6. Transaction History

#### Test Case 6.1: View Transactions
**Steps:**
1. Complete several transactions
2. Go to Profile > Transaction History
3. Verify all transactions listed

**Expected Result:**
- All transactions displayed
- Correct amounts and details
- Proper date formatting

#### Test Case 6.2: Filter Transactions
**Steps:**
1. Go to transaction history
2. Filter by "Sent" transactions
3. Filter by "Received" transactions
4. Search for specific transactions

**Expected Result:**
- Filters work correctly
- Search functionality works
- Results update properly

### 7. Error Handling

#### Test Case 7.1: Network Errors
**Steps:**
1. Disconnect internet
2. Try to perform various actions
3. Reconnect internet

**Expected Result:**
- Appropriate error messages
- App recovers when connection restored

#### Test Case 7.2: Invalid Data
**Steps:**
1. Try to enter invalid card numbers
2. Try to enter negative amounts
3. Try to enter invalid expiry dates

**Expected Result:**
- Validation errors displayed
- Invalid data rejected

### 8. Security Testing

#### Test Case 8.1: Token Expiry
**Steps:**
1. Login to app
2. Wait for token to expire (24 hours)
3. Try to perform actions

**Expected Result:**
- User logged out automatically
- Redirected to login screen

#### Test Case 8.2: Data Encryption
**Steps:**
1. Check network requests
2. Verify sensitive data encrypted

**Expected Result:**
- Card details not stored in plain text
- API calls use HTTPS
- Sensitive data properly tokenized

## Performance Testing

### Load Testing
1. Test with multiple concurrent users
2. Test QR code generation under load
3. Test payment processing under load

### Memory Testing
1. Monitor app memory usage
2. Test with large transaction histories
3. Test QR code generation memory usage

## Compatibility Testing

### Device Testing
- Test on different Android devices
- Test on different iOS devices
- Test on different screen sizes

### OS Testing
- Test on different Android versions
- Test on different iOS versions
- Test on different browsers (web version)

## Automated Testing

### Unit Tests
```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

### Integration Tests
```bash
# Run integration tests
npm run test:integration
```

## Bug Reporting

When reporting bugs, include:
1. Device information
2. Steps to reproduce
3. Expected vs actual behavior
4. Screenshots or logs
5. App version and build number

## Test Data Cleanup

After testing, clean up test data:
1. Remove test user accounts
2. Clear test transactions
3. Remove test cards
4. Reset Firebase database if needed

---

**Note**: This is a prototype application. All transactions are simulated using sandbox APIs and should not be used for real financial transactions.