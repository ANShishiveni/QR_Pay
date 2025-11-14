const twilio = require('twilio');

class TwilioService {
  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  }

  /**
   * Send SMS message
   * @param {string} to - Recipient phone number
   * @param {string} message - Message content
   * @returns {Promise<Object>} - Twilio message result
   */
  async sendSMS(to, message) {
    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.phoneNumber,
        to: to
      });

      console.log(`SMS sent successfully to ${to}:`, result.sid);
      return {
        success: true,
        messageId: result.sid,
        status: result.status
      };
    } catch (error) {
      console.error('SMS sending failed:', error);
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Send OTP via SMS
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} otp - OTP code
   * @param {string} purpose - Purpose of OTP (e.g., 'payment_verification')
   * @returns {Promise<Object>} - SMS result
   */
  async sendOTP(phoneNumber, otp, purpose = 'verification') {
    const message = `Your NamPay ${purpose} code is: ${otp}. This code expires in 5 minutes. Do not share this code with anyone.`;
    
    return await this.sendSMS(phoneNumber, message);
  }

  /**
   * Validate phone number format
   * @param {string} phoneNumber - Phone number to validate
   * @returns {boolean} - Is valid phone number
   */
  isValidPhoneNumber(phoneNumber) {
    // Basic E.164 format validation
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  /**
   * Format phone number to E.164
   * @param {string} phoneNumber - Raw phone number
   * @returns {string} - Formatted phone number
   */
  formatPhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Add country code if missing (assuming Namibia +264)
    if (digits.length === 9 && digits.startsWith('81')) {
      return `+264${digits}`;
    }
    
    // Add + if missing
    if (!phoneNumber.startsWith('+')) {
      return `+${digits}`;
    }
    
    return phoneNumber;
  }
}

module.exports = new TwilioService();
