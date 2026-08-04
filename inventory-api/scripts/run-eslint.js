const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function resolvePackageBinEntrypoint(packageName, binName) {
  const packageJsonPath = require.resolve(`${packageName}/package.json`, {
    paths: [process.cwd(), __dirname],
  });
  const packageDirectory = path.dirname(packageJsonPath);
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const binField = packageJson.bin;

  const relativeEntrypoint = typeof binField === 'string'
    ? binField
    : binField?.[binName];

  if (!relativeEntrypoint) {
    throw new Error(`No se pudo resolver el binario \`${binName}\` para el paquete \`${packageName}\`.`);
  }

  return path.join(packageDirectory, relativeEntrypoint);
}

function main() {
  const eslintEntrypoint = resolvePackageBinEntrypoint('eslint', 'eslint');
  const result = spawnSync(process.execPath, [eslintEntrypoint, ...process.argv.slice(2)], {
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
  resolvePackageBinEntrypoint,
};
