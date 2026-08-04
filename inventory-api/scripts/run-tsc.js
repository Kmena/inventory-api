const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function resolveTypeScriptEntrypoint() {
  const packageJsonPath = require.resolve('typescript/package.json', {
    paths: [process.cwd(), __dirname],
  });
  const packageDirectory = path.dirname(packageJsonPath);
  const fallbackEntrypoint = path.join(packageDirectory, 'lib', 'tsc.js');

  if (!fs.existsSync(fallbackEntrypoint)) {
    throw new Error('No se pudo resolver la entrada local de TypeScript en lib/tsc.js.');
  }

  return fallbackEntrypoint;
}

function main() {
  const tscEntrypoint = resolveTypeScriptEntrypoint();
  const result = spawnSync(process.execPath, [tscEntrypoint, ...process.argv.slice(2)], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 1);
}

if (require.main === module) {
  main();
}

module.exports = {
  resolveTypeScriptEntrypoint,
};
