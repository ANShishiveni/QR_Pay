// Importing the application never initializes a paid provider or sends SMS.
class TwilioService {
  constructor(config = {}) {
    this.accountSid = config.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID;
    this.authToken = config.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN;
    this.from = config.twilioPhoneNumber || process.env.TWILIO_PHONE_NUMBER;
    if (!/^AC[a-fA-F0-9]{32}$/.test(this.accountSid || '') || !this.authToken || !/^\+[1-9]\d{7,14}$/.test(this.from || '')) {
      throw Object.assign(new Error('The verification provider is unavailable'), { status: 503, code: 'OTP_PROVIDER_UNAVAILABLE' });
    }
  }
  async sendOTP(destination, code) {
    if (!/^\+[1-9]\d{7,14}$/.test(destination || '') || !/^\d{6}$/.test(code || '')) {
      throw Object.assign(new Error('The verification destination is invalid'), { status: 400, code: 'OTP_DESTINATION_INVALID' });
    }
    try {
      this.client ||= require('twilio')(this.accountSid, this.authToken, { lazyLoading: true, autoRetry: false, timeout: 10000 });
      await this.client.messages.create({ to: destination, from: this.from,
        body: `Your NamPay simulated-payment verification code is ${code}. It expires in five minutes. Do not share this code.` });
    } catch {
      // Provider exceptions can contain phone numbers and request bodies.
      throw Object.assign(new Error('The verification code could not be delivered'), { status: 503, code: 'OTP_DELIVERY_FAILED' });
    }
  }
}
module.exports = { TwilioService };
