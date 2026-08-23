const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
}

test('recipe routes are mounted in the Express app with the approved mount path', () => {
  const appSource = read('src/app.js');

  assert.match(appSource, /const recipeRouter = require\('\.\/routes\/recipe\.routes'\);/);
  assert.match(appSource, /app\.use\('\/api\/recipes', \.{3}mediumPayloadParsers, recipeRouter\);/);
});

test('recipe route contract exposes recipe version creation, approval and draft update seams', () => {
  const routeSource = read('src/routes/recipe.routes.js');

  assert.match(routeSource, /router\.post\('\/:id\/versions'/);
  assert.match(routeSource, /router\.put\('\/versions\/:id'/);
  assert.match(routeSource, /router\.post\('\/versions\/:id\/approve'/);
  assert.match(routeSource, /authorizeAccessPolicy\('recipe\.manage'\)/);
  assert.match(routeSource, /authorizeAccessPolicy\('recipe\.approve'\)/);
});
