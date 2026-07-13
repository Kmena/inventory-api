const js = require('@eslint/js');

const commonJsGlobals = {
  __dirname: 'readonly',
  console: 'readonly',
  module: 'readonly',
  process: 'readonly',
  Buffer: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  AbortSignal: 'readonly',
  fetch: 'readonly',
};

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'src/public/**',
      'storage/**',
      'back_end/**',
      'front_end/**',
      'prisma/migrations/**',
      '*.log',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'scripts/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: commonJsGlobals,
    },
    rules: {
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
];
