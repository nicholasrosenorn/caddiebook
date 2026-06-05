// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Keep the Expo bundler out of the backend workspace. `server/` has its own
// package.json and Node-only dependencies (pg, hono, drizzle) that Metro must
// never try to watch, resolve, or bundle into the app.
config.resolver.blockList = [/\/server\/.*/];

module.exports = config;
