import { SignJWT, jwtVerify } from 'jose';

import { env } from '../env';

// Our own session tokens (HS256, signed with JWT_SECRET). Short-lived access
// token + long-lived refresh token. `typ` distinguishes them so a refresh
// token can't be used as an access token or vice versa.
const secret = new TextEncoder().encode(env.jwtSecret);

const ACCESS_TTL = '1h';
const REFRESH_TTL = '60d';

type TokenType = 'access' | 'refresh';

async function sign(userId: string, typ: TokenType, ttl: string): Promise<string> {
  return new SignJWT({ typ })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(secret);
}

export function signAccessToken(userId: string): Promise<string> {
  return sign(userId, 'access', ACCESS_TTL);
}

export function signRefreshToken(userId: string): Promise<string> {
  return sign(userId, 'refresh', REFRESH_TTL);
}

// Verify a token and assert its type. Returns the user id (subject).
export async function verifySessionToken(token: string, expected: TokenType): Promise<string> {
  const { payload } = await jwtVerify(token, secret);
  if (payload.typ !== expected || typeof payload.sub !== 'string') {
    throw new Error('invalid token');
  }
  return payload.sub;
}
