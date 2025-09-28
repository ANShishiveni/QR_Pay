import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '../utils/asyncStorage';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

class PushNotificationService {
  constructor() {
    this.expoPushToken = null;
    this.notificationListener = null;
    this.responseListener = null;
  }

  /**
   * Register for push notifications
   * @returns {Promise<string|null>} - Expo push token
   */
  async registerForPushNotifications() {
    try {
      if (!Device.isDevice) {
        console.log('Must use physical device for Push Notifications');
        return null;
      }

      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permissions if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return null;
      }

      // Get the push token
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: 'your-expo-project-id', // Replace with your actual project ID
      });

      this.expoPushToken = token.data;
      
      // Store token locally
      await AsyncStorage.setItem('expoPushToken', this.expoPushToken);
      
      console.log('Expo push token:', this.expoPushToken);
      return this.expoPushToken;

    } catch (error) {
      console.error('Failed to register for push notifications:', error);
      return null;
    }
  }

  /**
   * Get stored push token
   * @returns {Promise<string|null>} - Stored push token
   */
  async getStoredToken() {
    try {
      const token = await AsyncStorage.getItem('expoPushToken');
      this.expoPushToken = token;
      return token;
    } catch (error) {
      console.error('Failed to get stored push token:', error);
      return null;
    }
  }

  /**
   * Send local notification
   * @param {Object} notification - Notification data
   * @returns {Promise<string>} - Notification ID
   */
  async sendLocalNotification(notification) {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title || 'NamPay',
          body: notification.body,
          data: notification.data || {},
          sound: 'default',
        },
        trigger: notification.trigger || null,
      });

      return notificationId;
    } catch (error) {
      console.error('Failed to send local notification:', error);
      throw error;
    }
  }

  /**
   * Send OTP notification
   * @param {string} otp - OTP code
   * @param {string} purpose - Purpose of OTP
   * @returns {Promise<string>} - Notification ID
   */
  async sendOTPNotification(otp, purpose = 'verification') {
    const notification = {
      title: 'NamPay OTP',
      body: `Your ${purpose} code is: ${otp}. This code expires in 5 minutes.`,
      data: {
        type: 'otp',
        otp: otp,
        purpose: purpose,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      },
    };

    return await this.sendLocalNotification(notification);
  }

  /**
   * Send payment notification
   * @param {Object} paymentData - Payment information
   * @returns {Promise<string>} - Notification ID
   */
  async sendPaymentNotification(paymentData) {
    const { amount, recipient, type = 'sent' } = paymentData;
    
    const notification = {
      title: `Payment ${type === 'sent' ? 'Sent' : 'Received'}`,
      body: type === 'sent' 
        ? `You sent N$ ${amount} to ${recipient}`
        : `You received N$ ${amount} from ${recipient}`,
      data: {
        type: 'payment',
        amount: amount,
        recipient: recipient,
        paymentType: type,
      },
    };

    return await this.sendLocalNotification(notification);
  }

  /**
   * Send security alert notification
   * @param {string} message - Security message
   * @returns {Promise<string>} - Notification ID
   */
  async sendSecurityAlert(message) {
    const notification = {
      title: 'Security Alert',
      body: message,
      data: {
        type: 'security',
        priority: 'high',
      },
    };

    return await this.sendLocalNotification(notification);
  }

  /**
   * Setup notification listeners
   * @param {Function} onNotificationReceived - Callback for received notifications
   * @param {Function} onNotificationResponse - Callback for notification responses
   */
  setupNotificationListeners(onNotificationReceived, onNotificationResponse) {
    // Listener for notifications received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    });

    // Listener for when user taps on or interacts with a notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      if (onNotificationResponse) {
        onNotificationResponse(response);
      }
    });
  }

  /**
   * Remove notification listeners
   */
  removeNotificationListeners() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
      this.notificationListener = null;
    }

    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
      this.responseListener = null;
    }
  }

  /**
   * Clear all notifications
   * @returns {Promise<void>}
   */
  async clearAllNotifications() {
    try {
      await Notifications.dismissAllNotificationsAsync();
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  }

  /**
   * Get notification permissions status
   * @returns {Promise<Object>} - Permission status
   */
  async getPermissionStatus() {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return {
        granted: status === 'granted',
        status: status,
      };
    } catch (error) {
      console.error('Failed to get permission status:', error);
      return {
        granted: false,
        status: 'unknown',
      };
    }
  }

  /**
   * Request notification permissions
   * @returns {Promise<Object>} - Permission result
   */
  async requestPermissions() {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      return {
        granted: status === 'granted',
        status: status,
      };
    } catch (error) {
      console.error('Failed to request permissions:', error);
      return {
        granted: false,
        status: 'error',
      };
    }
  }

  /**
   * Initialize push notification service
   * @returns {Promise<Object>} - Initialization result
   */
  async initialize() {
    try {
      // Get or register for push token
      let token = await this.getStoredToken();
      if (!token) {
        token = await this.registerForPushNotifications();
      }

      return {
        success: true,
        token: token,
        hasPermission: token !== null,
      };
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export default new PushNotificationService();
