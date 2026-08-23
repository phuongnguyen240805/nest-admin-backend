#!/usr/bin/env node

/**
 * Generate a pruned deployment lockfile from the package.json produced by
 * NxAppWebpackPlugin({ generatePackageJson: true }).
 *
 * Why this exists:
 * @nx/js:prune-lockfile expects <projectRoot>/package.json. This workspace
 * intentionally keeps dependencies at the workspace root and generates each
 * app package.json in dist/, so the stock prune executor cannot be used
 * directly without migrating the whole dependency layout.
 */
const fs = require('fs');
const path = require('path');
const { createProjectGraphAsync, detectPackageManager } = require('@nx/devkit');
const { createLockFile, getLockFileName } = require('@nx/js');

async function main() {
  const [, , projectName, outputDirArg, ...extraDeps] = process.argv;

  if (!projectName || !outputDirArg) {
    console.error(
      'Usage: node tools/generate-deploy-lockfile.cjs <project-name> <output-dir> [pkg=version ...]'
    );
    process.exit(2);
  }

  const outputDir = path.resolve(process.cwd(), outputDirArg);
  const packageJsonPath = path.join(outputDir, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    console.error(`[deploy-lockfile] Missing generated package.json: ${packageJsonPath}`);
    console.error('[deploy-lockfile] Run the application build before this script.');
    process.exit(3);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  packageJson.dependencies = packageJson.dependencies || {};

  // Dynamic CLI/runtime dependencies are not always visible to webpack's
  // static dependency analysis. Optional pkg=version args make them explicit
  // before the lockfile is generated, keeping the subsequent install frozen.
  for (const spec of extraDeps) {
    const splitAt = spec.lastIndexOf('=');
    if (splitAt <= 0 || splitAt === spec.length - 1) {
      throw new Error(`Invalid extra dependency '${spec}'. Expected package=version.`);
    }
    const name = spec.slice(0, splitAt);
    const version = spec.slice(splitAt + 1);
    packageJson.dependencies[name] = version;
  }

  const unresolvedWorkspaceDeps = Object.entries(packageJson.dependencies)
    .filter(([, version]) => typeof version === 'string' && version.startsWith('workspace:'));

  if (unresolvedWorkspaceDeps.length) {
    console.error('[deploy-lockfile] Generated package.json still contains workspace:* dependencies:');
    for (const [name, version] of unresolvedWorkspaceDeps) {
      console.error(`  - ${name}: ${version}`);
    }
    console.error(
      '[deploy-lockfile] Stop here rather than producing a broken image. These dependencies must be bundled or copied explicitly.'
    );
    process.exit(4);
  }

  const graph = await createProjectGraphAsync();
  if (!graph.nodes[projectName]) {
    throw new Error(`Nx project '${projectName}' was not found in the project graph.`);
  }

  const packageManager = detectPackageManager();
  if (packageManager !== 'pnpm') {
    throw new Error(`Expected pnpm workspace, detected '${packageManager}'.`);
  }

  // Persist any explicit dynamic dependencies before creating the lockfile.
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

  const lockfile = createLockFile(packageJson, graph, packageManager);
  const lockfileName = getLockFileName(packageManager);
  const lockfilePath = path.join(outputDir, lockfileName);
  fs.writeFileSync(lockfilePath, lockfile, 'utf8');

  console.log(`[deploy-lockfile] ${projectName}`);
  console.log(`[deploy-lockfile] package: ${packageJsonPath}`);
  console.log(`[deploy-lockfile] lockfile: ${lockfilePath}`);
  console.log(`[deploy-lockfile] production deps: ${Object.keys(packageJson.dependencies).length}`);
}

main().catch((error) => {
  console.error('[deploy-lockfile] Failed:', error);
  process.exit(1);
});
