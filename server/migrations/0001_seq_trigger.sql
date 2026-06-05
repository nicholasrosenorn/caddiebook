-- Global monotonic sequence: the single source of the pull cursor. One shared
-- sequence across all syncable tables makes "give me everything changed since N"
-- a single bigint comparison.
CREATE SEQUENCE IF NOT EXISTS "global_seq";
--> statement-breakpoint
-- Bump server_seq on UPDATE. Inserts are covered by the column DEFAULT below;
-- this trigger ensures modifications also advance the cursor so pulls catch them.
CREATE OR REPLACE FUNCTION set_server_seq() RETURNS trigger AS $$
BEGIN
  NEW.server_seq := nextval('global_seq');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
ALTER TABLE "rounds" ALTER COLUMN "server_seq" SET DEFAULT nextval('global_seq');
--> statement-breakpoint
ALTER TABLE "courses" ALTER COLUMN "server_seq" SET DEFAULT nextval('global_seq');
--> statement-breakpoint
ALTER TABLE "tees" ALTER COLUMN "server_seq" SET DEFAULT nextval('global_seq');
--> statement-breakpoint
ALTER TABLE "holes" ALTER COLUMN "server_seq" SET DEFAULT nextval('global_seq');
--> statement-breakpoint
ALTER TABLE "shots" ALTER COLUMN "server_seq" SET DEFAULT nextval('global_seq');
--> statement-breakpoint
ALTER TABLE "putts" ALTER COLUMN "server_seq" SET DEFAULT nextval('global_seq');
--> statement-breakpoint
ALTER TABLE "post_round_reviews" ALTER COLUMN "server_seq" SET DEFAULT nextval('global_seq');
--> statement-breakpoint
ALTER TABLE "pre_round_goals" ALTER COLUMN "server_seq" SET DEFAULT nextval('global_seq');
--> statement-breakpoint
ALTER TABLE "journal_entries" ALTER COLUMN "server_seq" SET DEFAULT nextval('global_seq');
--> statement-breakpoint
ALTER TABLE "app_settings" ALTER COLUMN "server_seq" SET DEFAULT nextval('global_seq');
--> statement-breakpoint
CREATE TRIGGER "rounds_server_seq" BEFORE UPDATE ON "rounds" FOR EACH ROW EXECUTE FUNCTION set_server_seq();
--> statement-breakpoint
CREATE TRIGGER "courses_server_seq" BEFORE UPDATE ON "courses" FOR EACH ROW EXECUTE FUNCTION set_server_seq();
--> statement-breakpoint
CREATE TRIGGER "tees_server_seq" BEFORE UPDATE ON "tees" FOR EACH ROW EXECUTE FUNCTION set_server_seq();
--> statement-breakpoint
CREATE TRIGGER "holes_server_seq" BEFORE UPDATE ON "holes" FOR EACH ROW EXECUTE FUNCTION set_server_seq();
--> statement-breakpoint
CREATE TRIGGER "shots_server_seq" BEFORE UPDATE ON "shots" FOR EACH ROW EXECUTE FUNCTION set_server_seq();
--> statement-breakpoint
CREATE TRIGGER "putts_server_seq" BEFORE UPDATE ON "putts" FOR EACH ROW EXECUTE FUNCTION set_server_seq();
--> statement-breakpoint
CREATE TRIGGER "post_round_reviews_server_seq" BEFORE UPDATE ON "post_round_reviews" FOR EACH ROW EXECUTE FUNCTION set_server_seq();
--> statement-breakpoint
CREATE TRIGGER "pre_round_goals_server_seq" BEFORE UPDATE ON "pre_round_goals" FOR EACH ROW EXECUTE FUNCTION set_server_seq();
--> statement-breakpoint
CREATE TRIGGER "journal_entries_server_seq" BEFORE UPDATE ON "journal_entries" FOR EACH ROW EXECUTE FUNCTION set_server_seq();
--> statement-breakpoint
CREATE TRIGGER "app_settings_server_seq" BEFORE UPDATE ON "app_settings" FOR EACH ROW EXECUTE FUNCTION set_server_seq();
--> statement-breakpoint
-- Pull path: WHERE user_id = ? AND server_seq > ? ORDER BY server_seq.
CREATE INDEX "rounds_user_seq_idx" ON "rounds" ("user_id","server_seq");
--> statement-breakpoint
CREATE INDEX "courses_user_seq_idx" ON "courses" ("user_id","server_seq");
--> statement-breakpoint
CREATE INDEX "tees_user_seq_idx" ON "tees" ("user_id","server_seq");
--> statement-breakpoint
CREATE INDEX "holes_user_seq_idx" ON "holes" ("user_id","server_seq");
--> statement-breakpoint
CREATE INDEX "shots_user_seq_idx" ON "shots" ("user_id","server_seq");
--> statement-breakpoint
CREATE INDEX "putts_user_seq_idx" ON "putts" ("user_id","server_seq");
--> statement-breakpoint
CREATE INDEX "post_round_reviews_user_seq_idx" ON "post_round_reviews" ("user_id","server_seq");
--> statement-breakpoint
CREATE INDEX "pre_round_goals_user_seq_idx" ON "pre_round_goals" ("user_id","server_seq");
--> statement-breakpoint
CREATE INDEX "journal_entries_user_seq_idx" ON "journal_entries" ("user_id","server_seq");
--> statement-breakpoint
CREATE INDEX "app_settings_user_seq_idx" ON "app_settings" ("user_id","server_seq");
