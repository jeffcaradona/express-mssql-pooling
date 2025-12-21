module.exports = {
    env: {
        node: true,
        es6: true,
    },
    parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
    },
    extends: [
        'eslint:recommended',
        'plugin:node/recommended',
        'plugin:express/recommended'
    ],
    plugins: [
        'node',
        'express'
    ],
    rules: {
        'no-console': 'warn',
        'prefer-const': 'error',
        'node/no-missing-require': 'error',
        'express/no-deprecated': 'warn'
    }
};