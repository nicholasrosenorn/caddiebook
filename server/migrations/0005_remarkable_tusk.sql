CREATE TABLE "push_tokens" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "round_share_notifications" (
	"round_owner_id" uuid NOT NULL,
	"round_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "round_share_notifications_round_owner_id_round_id_pk" PRIMARY KEY("round_owner_id","round_id")
);
--> statement-breakpoint
CREATE INDEX "push_tokens_user_idx" ON "push_tokens" USING btree ("user_id");--> statement-breakpoint
-- Backfill: mark every already-completed round as "already notified" so the
-- first sync after deploy can't fire a notification storm for historical rounds.
-- Only new completions (no ledger row) will notify going forward.
INSERT INTO "round_share_notifications" ("round_owner_id", "round_id")
SELECT "user_id", "id" FROM "rounds" WHERE "completed_at" IS NOT NULL
ON CONFLICT DO NOTHING;