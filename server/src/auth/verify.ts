import { createRemoteJWKSet, jwtVerify } from 'jose';

import { env } from '../env';

// Verify provider identity tokens against the provider's published JWKS.
// jose caches the remote key sets, so this isn't a network round-trip per call.

const appleJwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export type ProviderIdentity = { sub: string; email: string | null };

function identity(payload: { sub?: string; email?: unknown }): ProviderIdentity {
  if (typeof payload.sub !== 'string') throw new Error('token missing sub');
  return { sub: payload.sub, email: typeof payload.email === 'string' ? payload.email : null };
}

// Apple: aud = the app bundle id; iss = https://appleid.apple.com.
export async function verifyAppleToken(idToken: string): Promise<ProviderIdentity> {
  const { payload } = await jwtVerify(idToken, appleJwks, {
    issuer: 'https://appleid.apple.com',
    audience: env.appleBundleId,
  });
  return identity(payload);
}

// Google: aud ∈ configured OAuth client ids; iss accepts both forms Google uses.
export async function verifyGoogleToken(idToken: string): Promise<ProviderIdentity> {
  if (env.googleClientIds.length === 0) {
    throw new Error('Google sign-in not configured (GOOGLE_CLIENT_IDS empty)');
  }
  const { payload } = await jwtVerify(idToken, googleJwks, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: env.googleClientIds,
  });
  return identity(payload);
}
