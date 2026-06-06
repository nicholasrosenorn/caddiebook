import { SignJWT, jwtVerify } from 'jose';

import { env } from '../env';

// Our own session tokens (HS256, signed with JWT_SECRET). Short-lived access
// token + long-lived refresh token. `typ` distinguishes them so a refresh
// token can't be used as an access token or vice versa.
const secret = new TextEncoder().encode(env.jwtSecret);

const ACCESS_TTL = '1h';
const REFRESH_TTL = '60d';

type TokenType = 'access' | 'refresh';

export const REFRESH_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days, for the DB expiry row

export function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({ typ: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(secret);
}

// Refresh tokens carry a `jti` (the refresh_tokens row id) and `fid` (rotation
// family) so the server can look them up, rotate, and revoke families.
export function signRefreshToken(userId: string, jti: string, familyId: string): Promise<string> {
  return new SignJWT({ typ: 'refresh', fid: familyId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(REFRESH_TTL)
    .sign(secret);
}

// Verify a token and assert its type. Returns the user id (subject).
export async function verifySessionToken(token: string, expected: TokenType): Promise<string> {
  const { payload } = await jwtVerify(token, secret);
  if (payload.typ !== expected || typeof payload.sub !== 'string') {
    throw new Error('invalid token');
  }
  return payload.sub;
}

export type RefreshClaims = { userId: string; jti: string; familyId: string };

// Verify a refresh token's signature + type and return its identity claims.
// Throws if the signature is bad, the type is wrong, or the jti/fid are missing
// (e.g. legacy pre-rotation tokens) — callers treat that as an invalid refresh.
export async function verifyRefreshToken(token: string): Promise<RefreshClaims> {
  const { payload } = await jwtVerify(token, secret);
  if (
    payload.typ !== 'refresh' ||
    typeof payload.sub !== 'string' ||
    typeof payload.jti !== 'string' ||
    typeof payload.fid !== 'string'
  ) {
    throw new Error('invalid refresh token');
  }
  return { userId: payload.sub, jti: payload.jti, familyId: payload.fid };
}
