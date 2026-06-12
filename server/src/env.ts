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
  // POST /auth/dev is only mounted when this is exactly '1'.
  devAuth: optional('DEV_AUTH', '0') === '1',
  // Comma-separated user ids allowed to call the /admin moderation endpoints.
  adminUserIds: optional('ADMIN_USER_IDS', '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0),
};

export type Env = typeof env;
