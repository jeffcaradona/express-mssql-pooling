import js from '@eslint/js';
import nodePlugin from 'eslint-plugin-n';

export default [
  js.configs.recommended,
  nodePlugin.configs['flat/recommended'],
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'n/no-missing-import': 'off',
      'n/no-unpublished-import': 'off',
    },
  },
  {
    ignores: ['node_modules/**', 'public/**'],
  },
];