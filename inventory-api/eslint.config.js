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

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  navigator: 'readonly',
  location: 'readonly',
  history: 'readonly',
  fetch: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  Blob: 'readonly',
  FormData: 'readonly',
  FileReader: 'readonly',
  HTMLElement: 'readonly',
  Node: 'readonly',
  Event: 'readonly',
  CustomEvent: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  alert: 'readonly',
  confirm: 'readonly',
  File: 'readonly',
  console: 'readonly',
  XLSX: 'readonly',
  L: 'readonly',
  CSS: 'readonly',
};

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'storage/**',
      'back_end/**',
      'front_end/**',
      'prisma/migrations/**',
      'src/public/**/vendor/**',
      '*.log',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'scripts/**/*.js', 'tests/**/*.js'],
    ignores: ['src/public/**/*.js'],
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
  {
    files: ['src/public/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: browserGlobals,
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
