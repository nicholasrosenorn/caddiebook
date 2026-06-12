import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';

import { requireAuth, type AppEnv } from '../auth/middleware';
import { db } from '../db/client';
import { contentReports, users } from '../db/schema';
import { deleteRound } from '../data/service';
import { env } from '../env';
import { BODY_LIMIT, jsonBodyLimit } from '../middleware/body-limit';
import type { AdminReport, AdminReportsResponse, AdminResolveRequest, PublicProfile } from '../wire';

// Gate the admin moderation endpoints to the ADMIN_USER_IDS allowlist. Runs
// after requireAuth, so c.get('userId') is the verified caller.
const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const me = c.get('userId');
  if (!env.adminUserIds.includes(me)) {
    return c.json({ error: 'forbidden' }, 403);
  }
  await next();
});

export const adminRoutes = new Hono<AppEnv>();

adminRoutes.use('*', jsonBodyLimit(BODY_LIMIT.small));
adminRoutes.use('*', requireAuth);
adminRoutes.use('*', requireAdmin);

function profile(
  u: { id: string; username: string | null; firstName: string | null; lastName: string | null; avatar: string | null } | null,
): PublicProfile | null {
  if (!u) return null;
  return { id: u.id, username: u.username, firstName: u.firstName, lastName: u.lastName, avatar: u.avatar };
}

// GET /admin/reports?status=open — the moderation queue (open by default).
adminRoutes.get('/reports', async (c) => {
  const status = c.req.query('status') ?? 'open';
  const rows = await db
    .select({
      id: contentReports.id,
      reporterId: contentReports.reporterId,
      targetType: contentReports.targetType,
      targetOwnerId: contentReports.targetOwnerId,
      targetRoundId: contentReports.targetRoundId,
      reason: contentReports.reason,
      note: contentReports.note,
      status: contentReports.status,
      action: contentReports.action,
      createdAt: contentReports.createdAt,
      resolvedAt: contentReports.resolvedAt,
    })
    .from(contentReports)
    .where(eq(contentReports.status, status))
    .orderBy(desc(contentReports.createdAt))
    .limit(200);

  // Resolve reporter + target profiles in two batched lookups.
  const ids = [...new Set(rows.flatMap((r) => [r.reporterId, r.targetOwnerId]))];
  const profiles = new Map<string, PublicProfile>();
  if (ids.length > 0) {
    const us = await db
      .select({
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        avatar: users.avatar,
      })
      .from(users);
    for (const u of us) if (ids.includes(u.id)) profiles.set(u.id, profile(u)!);
  }

  const reports: AdminReport[] = rows.map((r) => ({
    id: r.id,
    reporter: profiles.get(r.reporterId) ?? null,
    target: profiles.get(r.targetOwnerId) ?? null,
    targetType: r.targetType as 'round' | 'user',
    targetOwnerId: r.targetOwnerId,
    targetRoundId: r.targetRoundId,
    reason: r.reason,
    note: r.note,
    status: r.status,
    action: r.action,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
  }));
  return c.json<AdminReportsResponse>({ reports });
});

// POST /admin/reports/:id/resolve { action } — action a report:
//  - remove_content: hard-delete the reported round (cascades to children/likes)
//  - ban_user:       set banned_at on the target so requireAuth ejects them
//  - dismiss:        no action, just close the report
adminRoutes.post('/reports/:id/resolve', async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => null)) as Partial<AdminResolveRequest> | null;
  const action = body?.action;
  if (action !== 'remove_content' && action !== 'ban_user' && action !== 'dismiss') {
    return c.json({ error: 'invalid action' }, 400);
  }

  const report = (await db.select().from(contentReports).where(eq(contentReports.id, id)).limit(1))[0];
  if (!report) return c.json({ error: 'report not found' }, 404);

  if (action === 'remove_content') {
    if (report.targetType === 'round' && report.targetRoundId) {
      await deleteRound(report.targetOwnerId, report.targetRoundId);
    }
  } else if (action === 'ban_user') {
    await db.update(users).set({ bannedAt: new Date() }).where(eq(users.id, report.targetOwnerId));
  }

  const resolution = action === 'dismiss' ? 'dismissed' : action === 'ban_user' ? 'banned' : 'removed';
  const newStatus = action === 'dismiss' ? 'dismissed' : 'resolved';
  await db
    .update(contentReports)
    .set({ status: newStatus, action: resolution, resolvedAt: new Date() })
    .where(and(eq(contentReports.id, id), eq(contentReports.status, 'open')));

  return c.json({ ok: true });
});
