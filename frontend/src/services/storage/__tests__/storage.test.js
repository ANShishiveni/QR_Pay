const { createPreferenceStore } = require('../preferenceStore');
const { createTokenStore } = require('../tokenStore');

function adapter() {
  const values = new Map();
  return {
    values,
    getItem: jest.fn(async key => values.get(key) ?? null),
    setItem: jest.fn(async (key, value) => values.set(key, value)),
    removeItem: jest.fn(async key => values.delete(key)),
    getAllKeys: jest.fn(async () => [...values.keys()]),
    multiRemove: jest.fn(async keys => keys.forEach(key => values.delete(key))),
  };
}

describe('storage boundaries', () => {
  test('native tokens use the secure adapter and deletion survives a new wrapper', async () => {
    const values = new Map();
    const secure = {
      getItemAsync: jest.fn(async key => values.get(key) ?? null),
      setItemAsync: jest.fn(async (key, value) => values.set(key, value)),
      deleteItemAsync: jest.fn(async key => values.delete(key)),
    };
    const store = createTokenStore(secure, { options: { keychainAccessible: 'device-only' } });
    await store.setToken('synthetic-test-token');
    expect(secure.setItemAsync).toHaveBeenCalledWith('nampay.session.v2', 'synthetic-test-token', { keychainAccessible: 'device-only' });
    expect(await createTokenStore(secure).getToken()).toBe('synthetic-test-token');
    await store.clearToken();
    expect(await store.getToken()).toBeNull();
  });

  test('web never writes or reads a token from JavaScript storage', async () => {
    const secure = { getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() };
    const store = createTokenStore(secure, { web: true });
    await store.setToken('must-not-be-persisted');
    expect(await store.getToken()).toBeNull();
    await store.clearToken();
    for (const method of Object.values(secure)) expect(method).not.toHaveBeenCalled();
  });

  test('invalid native sessions and secure-store failures propagate', async () => {
    const store = createTokenStore({ setItemAsync: async () => { throw new Error('locked'); } });
    await expect(store.setToken(null)).rejects.toThrow('valid session');
    await expect(store.setToken('test-only')).rejects.toThrow('locked');
  });

  test('tokens cannot be saved in preferences and profile data is memory-only', async () => {
    const storage = adapter();
    const store = createPreferenceStore(storage);
    await expect(store.setItem('authToken', 'test-only')).rejects.toThrow('secure session');
    await store.setItem('userData', '{"uid":"synthetic"}');
    expect(await store.getItem('userData')).toBe('{"uid":"synthetic"}');
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(await createPreferenceStore(storage).getItem('userData')).toBeNull();
  });

  test('non-sensitive preferences persist and account settings are isolated', async () => {
    const storage = adapter();
    const store = createPreferenceStore(storage);
    await store.setItem('appearance', 'dark');
    store.setUser('payer');
    await store.setItem('biometricEnabled', 'true');
    store.setUser('requester');
    expect(await store.getItem('biometricEnabled')).toBeNull();
    store.setUser('payer');
    expect(await store.getItem('biometricEnabled')).toBe('true');
    expect(await createPreferenceStore(storage).getItem('appearance')).toBe('dark');
    store.clearMemory();
    expect(await store.getItem('biometricEnabled')).toBeNull();
  });

  test('clearing NamPay preferences does not erase another application', async () => {
    const storage = adapter();
    storage.values.set('another-app', 'keep');
    const store = createPreferenceStore(storage);
    await store.setItem('appearance', 'dark');
    await store.clear();
    expect([...storage.values.entries()]).toEqual([['another-app', 'keep']]);
  });
});
