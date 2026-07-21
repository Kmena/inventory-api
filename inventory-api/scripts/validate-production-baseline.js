const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

const repositoryRoot = path.join(__dirname, '..');
const envFileName = process.env.ENV_FILE || '.env.production';
const envFilePath = path.join(repositoryRoot, envFileName);

if (fs.existsSync(envFilePath)) {
  dotenv.config({ path: envFilePath });
}

const requiredVariables = [
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'POSTGRES_DB',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'CORS_ORIGIN',
  'APP_BASE_URL',
  'JWT_SECRET',
];

const placeholderPatterns = [
  /replace_me/i,
  /change_this_super_secret_key/i,
];

function hasPlaceholderValue(value) {
  return placeholderPatterns.some((pattern) => pattern.test(String(value || '')));
}

function fail(message) {
  process.stderr.write(`${message}\n`);
}

const missingVariables = requiredVariables.filter((name) => !String(process.env[name] || '').trim());
if (missingVariables.length) {
  fail(`Missing required production variables: ${missingVariables.join(', ')}`);
  process.exit(1);
}

if (process.env.NODE_ENV !== 'production') {
  fail('NODE_ENV must be production for the production baseline.');
  process.exit(1);
}

if (hasPlaceholderValue(process.env.POSTGRES_PASSWORD)) {
  fail('POSTGRES_PASSWORD still contains a placeholder value.');
  process.exit(1);
}

if (hasPlaceholderValue(process.env.JWT_SECRET) || String(process.env.JWT_SECRET).trim().length < 32) {
  fail('JWT_SECRET must be replaced with a non-placeholder secret of at least 32 characters.');
  process.exit(1);
}

const requiredFiles = [
  'Dockerfile',
  'docker-compose.prod.yml',
  'src/routes/health.routes.js',
  'prisma/schema.prisma',
];

const missingFiles = requiredFiles.filter((relativePath) => !fs.existsSync(path.join(repositoryRoot, relativePath)));
if (missingFiles.length) {
  fail(`Missing required production baseline files: ${missingFiles.join(', ')}`);
  process.exit(1);
}

process.stdout.write('Production baseline validation passed.\n');
