import Toast from 'react-native-toast-message';

class ToastService {
  /**
   * Show success toast
   * @param {string} title - Toast title
   * @param {string} message - Toast message
   */
  success(title, message) {
    Toast.show({
      type: 'success',
      text1: title,
      text2: message,
      position: 'top',
      visibilityTime: 4000,
      autoHide: true,
      topOffset: 60,
    });
  }

  /**
   * Show error toast
   * @param {string} title - Toast title
   * @param {string} message - Toast message
   */
  error(title, message) {
    Toast.show({
      type: 'error',
      text1: title,
      text2: message,
      position: 'top',
      visibilityTime: 5000,
      autoHide: true,
      topOffset: 60,
    });
  }

  /**
   * Show info toast
   * @param {string} title - Toast title
   * @param {string} message - Toast message
   */
  info(title, message) {
    Toast.show({
      type: 'info',
      text1: title,
      text2: message,
      position: 'top',
      visibilityTime: 4000,
      autoHide: true,
      topOffset: 60,
    });
  }

  /**
   * Show warning toast
   * @param {string} title - Toast title
   * @param {string} message - Toast message
   */
  warning(title, message) {
    Toast.show({
      type: 'info', // Using info type for warning
      text1: title,
      text2: message,
      position: 'top',
      visibilityTime: 4000,
      autoHide: true,
      topOffset: 60,
    });
  }

  /**
   * Hide current toast
   */
  hide() {
    Toast.hide();
  }
}

export default new ToastService();
