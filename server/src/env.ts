// Centralized, validated environment access. Throws on boot if a required var
// is missing so the container fails fast rather than at first request.

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function optional(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.length > 0 ? v : fallback;
}

export const env = {
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  appleBundleId: optional('APPLE_BUNDLE_ID', 'com.caddiebook.app'),
  // Comma-separated Google OAuth client IDs accepted as the id_token audience.
  googleClientIds: optional('GOOGLE_CLIENT_IDS', '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0),
  port: Number(optional('PORT', '8080')),
  // Public origin the apps + invite links are served from. Used to build
  // shareable invite URLs (`${publicBaseUrl}/i/<code>`).
  publicBaseUrl: optional('PUBLIC_BASE_URL', 'https://api.caddiebook.app').replace(/\/$/, ''),
  // Universal-link association: the iOS app's `<TeamID>.<bundleId>` appID and the
  // Android release signing SHA-256 fingerprint (colon-separated hex). Served in
  // the AASA / assetlinks files so the OS verifies the domain claim. Empty values
  // mean the association files advertise no app (links still work as web pages).
  appleAppId: optional('APPLE_APP_ID', ''),
  androidSha256: optional('ANDROID_SHA256_FINGERPRINT', ''),
  // The numeric App Store id (e.g. '6444412345'), used only for the invite
  // landing page's iOS smart-app banner. Empty → no banner is emitted.
  appStoreId: optional('APP_STORE_ID', ''),
  // Store URLs the invite landing page links to when the app isn't installed.
  appStoreUrl: optional('APP_STORE_URL', 'https://apps.apple.com/app/caddiebook'),
  playStoreUrl: optional(
    'PLAY_STORE_URL',
    'https://play.google.com/store/apps/details?id=com.caddiebook.app',
  ),
  // POST /auth/dev is only mounted when this is exactly '1'.
  devAuth: optional('DEV_AUTH', '0') === '1',
  // Comma-separated user ids allowed to call the /admin moderation endpoints.
  adminUserIds: optional('ADMIN_USER_IDS', '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0),
};

export type Env = typeof env;
