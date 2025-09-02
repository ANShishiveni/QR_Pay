// Custom AsyncStorage implementation for web
class WebAsyncStorage {
  constructor() {
    this.storage = new Map();
  }

  async getItem(key) {
    try {
      const value = this.storage.get(key);
      return value || null;
    } catch (error) {
      console.error('AsyncStorage getItem error:', error);
      return null;
    }
  }

  async setItem(key, value) {
    try {
      this.storage.set(key, value);
      return true;
    } catch (error) {
      console.error('AsyncStorage setItem error:', error);
      return false;
    }
  }

  async removeItem(key) {
    try {
      this.storage.delete(key);
      return true;
    } catch (error) {
      console.error('AsyncStorage removeItem error:', error);
      return false;
    }
  }

  async clear() {
    try {
      this.storage.clear();
      return true;
    } catch (error) {
      console.error('AsyncStorage clear error:', error);
      return false;
    }
  }

  async getAllKeys() {
    try {
      return Array.from(this.storage.keys());
    } catch (error) {
      console.error('AsyncStorage getAllKeys error:', error);
      return [];
    }
  }

  async multiGet(keys) {
    try {
      return keys.map(key => [key, this.storage.get(key) || null]);
    } catch (error) {
      console.error('AsyncStorage multiGet error:', error);
      return keys.map(key => [key, null]);
    }
  }

  async multiSet(keyValuePairs) {
    try {
      keyValuePairs.forEach(([key, value]) => {
        this.storage.set(key, value);
      });
      return true;
    } catch (error) {
      console.error('AsyncStorage multiSet error:', error);
      return false;
    }
  }

  async multiRemove(keys) {
    try {
      keys.forEach(key => this.storage.delete(key));
      return true;
    } catch (error) {
      console.error('AsyncStorage multiRemove error:', error);
      return false;
    }
  }
}

const asyncStorage = new WebAsyncStorage();

// Export the default AsyncStorage instance
export default asyncStorage;

// Export useAsyncStorage hook (mock implementation)
export const useAsyncStorage = (key) => {
  return {
    getItem: () => asyncStorage.getItem(key),
    setItem: (value) => asyncStorage.setItem(key, value),
    removeItem: () => asyncStorage.removeItem(key),
  };
};
