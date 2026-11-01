const PREFIX = 'nampay.preferences.v2.';
const GLOBAL = new Set(['appearance', 'onboardingComplete', 'sessionLogoutPending']);
const ACCOUNT = new Set(['biometricEnabled', 'mfaPreferences', 'notificationPreferences']);

function createPreferenceStore(adapter) {
  const memory = new Map();
  let uid = null;
  function persistentKey(key) {
    if (GLOBAL.has(key)) return `${PREFIX}${key}`;
    if (ACCOUNT.has(key) && uid) return `${PREFIX}user.${encodeURIComponent(uid)}.${key}`;
    return null;
  }
  const store = {
    setUser(value) {
      if (uid !== value) memory.clear();
      uid = typeof value === 'string' && value ? value : null;
    },
    clearMemory() { memory.clear(); uid = null; },
    async getItem(key) {
      if (key === 'authToken') return null;
      const persisted = persistentKey(key);
      return persisted ? adapter.getItem(persisted) : memory.get(key) ?? null;
    },
    async setItem(key, value) {
      if (key === 'authToken') throw new Error('Use secure session storage for authentication.');
      if (typeof value !== 'string') throw new TypeError('Preference values must be strings.');
      const persisted = persistentKey(key);
      if (persisted) await adapter.setItem(persisted, value);
      else memory.set(key, value);
    },
    async removeItem(key) {
      memory.delete(key);
      const persisted = persistentKey(key);
      if (persisted) await adapter.removeItem(persisted);
    },
    async multiGet(keys) { return Promise.all(keys.map(async key => [key, await store.getItem(key)])); },
    async multiSet(entries) { await Promise.all(entries.map(([key, value]) => store.setItem(key, value))); },
    async multiRemove(keys) { await Promise.all(keys.map(key => store.removeItem(key))); },
    async clear() {
      memory.clear();
      const keys = (await adapter.getAllKeys()).filter(key => key.startsWith(PREFIX));
      await adapter.multiRemove(keys);
    },
  };
  return store;
}

module.exports = { createPreferenceStore };
