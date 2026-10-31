import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/dist-native/**', '**/.expo/**', '**/.local/**', '**/android/**', '**/ios/**', '**/coverage/**'] },
  {
    files: ['backend/**/*.js', 'frontend/**/*.{js,jsx}', 'scripts/*.{js,cjs}', '*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node, ...globals.jest, __DEV__: 'readonly' } },
    rules: { ...js.configs.recommended.rules,
      // Import/component usage is checked by Expo/Jest; native JSX does not use
      // React's identifiers as ordinary JavaScript variable references.
      'no-unused-vars': 'off', 'no-empty': ['error', { allowEmptyCatch: true }],
      // Validators intentionally reject control characters. Public errors also
      // deliberately omit caught transport/file causes containing private data.
      'no-control-regex': 'off', 'preserve-caught-error': 'off',
    },
  },
];
