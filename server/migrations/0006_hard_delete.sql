-- The /data API hard-deletes rows, so tombstones stop being written. Purge the
-- legacy soft-deleted rows, sweep orphans left behind by old LWW merges, then
-- add the unique indexes the /data upserts arbitrate on.

-- 1. Purge legacy tombstones everywhere.
DELETE FROM "rounds" WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint
DELETE FROM "courses" WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint
DELETE FROM "tees" WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint
DELETE FROM "holes" WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint
DELETE FROM "shots" WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint
DELETE FROM "putts" WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint
DELETE FROM "post_round_reviews" WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint
DELETE FROM "pre_round_goals" WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint
DELETE FROM "journal_entries" WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint
DELETE FROM "app_settings" WHERE "deleted_at" IS NOT NULL;--> statement-breakpoint

-- 2. Orphan sweep: children whose round no longer exists (old sync debris).
DELETE FROM "holes" h WHERE NOT EXISTS (
  SELECT 1 FROM "rounds" r WHERE r."user_id" = h."user_id" AND r."id" = h."round_id"
);--> statement-breakpoint
DELETE FROM "shots" s WHERE NOT EXISTS (
  SELECT 1 FROM "rounds" r WHERE r."user_id" = s."user_id" AND r."id" = s."round_id"
);--> statement-breakpoint
DELETE FROM "putts" p WHERE NOT EXISTS (
  SELECT 1 FROM "rounds" r WHERE r."user_id" = p."user_id" AND r."id" = p."round_id"
);--> statement-breakpoint
DELETE FROM "post_round_reviews" v WHERE NOT EXISTS (
  SELECT 1 FROM "rounds" r WHERE r."user_id" = v."user_id" AND r."id" = v."round_id"
);--> statement-breakpoint
DELETE FROM "pre_round_goals" g WHERE NOT EXISTS (
  SELECT 1 FROM "rounds" r WHERE r."user_id" = g."user_id" AND r."id" = g."round_id"
);--> statement-breakpoint

-- 3. Defensive dedupe (keep the newest updated_at) before the unique indexes.
DELETE FROM "holes" h USING (
  SELECT ctid, row_number() OVER (
    PARTITION BY "user_id", "round_id", "hole_number" ORDER BY "updated_at" DESC, ctid
  ) AS rn FROM "holes"
) d WHERE h.ctid = d.ctid AND d.rn > 1;--> statement-breakpoint
DELETE FROM "shots" s USING (
  SELECT ctid, row_number() OVER (
    PARTITION BY "user_id", "round_id", "hole_number", "shot_type" ORDER BY "updated_at" DESC, ctid
  ) AS rn FROM "shots"
) d WHERE s.ctid = d.ctid AND d.rn > 1;--> statement-breakpoint
DELETE FROM "post_round_reviews" v USING (
  SELECT ctid, row_number() OVER (
    PARTITION BY "user_id", "round_id" ORDER BY "updated_at" DESC, ctid
  ) AS rn FROM "post_round_reviews"
) d WHERE v.ctid = d.ctid AND d.rn > 1;--> statement-breakpoint
DELETE FROM "pre_round_goals" g USING (
  SELECT ctid, row_number() OVER (
    PARTITION BY "user_id", "round_id" ORDER BY "updated_at" DESC, ctid
  ) AS rn FROM "pre_round_goals"
) d WHERE g.ctid = d.ctid AND d.rn > 1;--> statement-breakpoint

-- 4. The /data upsert arbiter indexes.
CREATE UNIQUE INDEX IF NOT EXISTS "holes_slot_idx"
  ON "holes" ("user_id", "round_id", "hole_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shots_slot_idx"
  ON "shots" ("user_id", "round_id", "hole_number", "shot_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "post_round_reviews_round_idx"
  ON "post_round_reviews" ("user_id", "round_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pre_round_goals_round_idx"
  ON "pre_round_goals" ("user_id", "round_id");
