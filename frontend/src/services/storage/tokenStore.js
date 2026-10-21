const KEY = 'nampay.session.v2';

function createTokenStore(adapter, { web = false, options = {} } = {}) {
  return {
    async getToken() {
      if (web) return null;
      return adapter.getItemAsync(KEY, options);
    },
    async setToken(token) {
      // Browsers authenticate with an HttpOnly cookie, never a JS-persisted JWT.
      if (web) return;
      if (typeof token !== 'string' || !token || token.length > 8192) {
        throw new Error('The server did not provide a valid session.');
      }
      await adapter.setItemAsync(KEY, token, options);
    },
    async clearToken() {
      if (!web) await adapter.deleteItemAsync(KEY, options);
    },
  };
}

module.exports = { createTokenStore };
