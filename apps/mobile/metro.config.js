// Metro config for the pnpm monorepo: watch the repo root so changes to
// @armory/shared and @armory/ballistics hot-reload, and let Metro resolve
// modules from both the app and the workspace root.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// Prefer the workspace packages' source resolution via their package "exports".
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
