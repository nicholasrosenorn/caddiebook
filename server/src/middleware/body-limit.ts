import { bodyLimit } from 'hono/body-limit';
import type { MiddlewareHandler } from 'hono';

// Reject oversized request bodies before a handler buffers them, blunting
// memory-exhaustion DoS. Each route group picks a ceiling sized to its largest
// legitimate payload (see call sites); the legacy /sync flush gets a generous
// cap because it migrates a whole account in one POST.
export function jsonBodyLimit(maxBytes: number): MiddlewareHandler {
  return bodyLimit({
    maxSize: maxBytes,
    onError: (c) => c.json({ error: 'request body too large' }, 413),
  });
}

// Named ceilings so the policy reads at a glance.
export const BODY_LIMIT = {
  /** Small token/identifier payloads (sign-in id tokens, usernames). */
  small: 32 * 1024,
  /** A full offline round PUT with embedded holes is only a few KB; generous. */
  data: 512 * 1024,
  /** Legacy /sync flush migrates a whole local DB in one un-chunked POST. */
  legacy: 32 * 1024 * 1024,
} as const;
