CREATE TABLE "app_settings" (
	"key" text NOT NULL,
	"value" text,
	"user_id" uuid NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text,
	"server_seq" bigint NOT NULL,
	CONSTRAINT "app_settings_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" text NOT NULL,
	"name" text,
	"created_at" text,
	"user_id" uuid NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text,
	"server_seq" bigint NOT NULL,
	CONSTRAINT "courses_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "holes" (
	"id" text NOT NULL,
	"round_id" text,
	"hole_number" integer,
	"par" integer,
	"fir" integer,
	"gir" integer,
	"up_and_down" integer,
	"approach_distance_yds" integer,
	"approach_club" text,
	"drive_club" text,
	"score" integer,
	"putts" integer,
	"chip_shots" integer,
	"sand_shots" integer,
	"penalties" integer,
	"green_blocked" integer,
	"notes" text,
	"user_id" uuid NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text,
	"server_seq" bigint NOT NULL,
	CONSTRAINT "holes_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" text NOT NULL,
	"tag" text,
	"body" text,
	"created_at" text,
	"user_id" uuid NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text,
	"server_seq" bigint NOT NULL,
	CONSTRAINT "journal_entries_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "post_round_reviews" (
	"id" text NOT NULL,
	"round_id" text,
	"most_costly" text,
	"decision_making_rating" integer,
	"common_miss" text,
	"range_focus" text,
	"overall_rating" integer,
	"created_at" text,
	"user_id" uuid NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text,
	"server_seq" bigint NOT NULL,
	CONSTRAINT "post_round_reviews_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "pre_round_goals" (
	"id" text NOT NULL,
	"round_id" text,
	"execution_goal" text,
	"strategic_goal" text,
	"mental_goal" text,
	"created_at" text,
	"user_id" uuid NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text,
	"server_seq" bigint NOT NULL,
	CONSTRAINT "pre_round_goals_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "putts" (
	"id" text NOT NULL,
	"round_id" text,
	"hole_number" integer,
	"distance_ft" integer,
	"made" integer,
	"created_at" text,
	"user_id" uuid NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text,
	"server_seq" bigint NOT NULL,
	CONSTRAINT "putts_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" text NOT NULL,
	"course_name" text,
	"date_played" text,
	"hole_count" integer,
	"completed_at" text,
	"tee_name" text,
	"course_rating" double precision,
	"slope_rating" double precision,
	"include_in_handicap" integer,
	"created_at" text,
	"user_id" uuid NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text,
	"server_seq" bigint NOT NULL,
	CONSTRAINT "rounds_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "shots" (
	"id" text NOT NULL,
	"round_id" text,
	"hole_number" integer,
	"shot_type" text,
	"x_norm" double precision,
	"y_norm" double precision,
	"intended_x_norm" double precision,
	"intended_y_norm" double precision,
	"notes" text,
	"user_id" uuid NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text,
	"server_seq" bigint NOT NULL,
	CONSTRAINT "shots_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "tees" (
	"id" text NOT NULL,
	"course_id" text,
	"name" text,
	"course_rating" double precision,
	"slope_rating" double precision,
	"par" integer,
	"created_at" text,
	"user_id" uuid NOT NULL,
	"updated_at" text NOT NULL,
	"deleted_at" text,
	"server_seq" bigint NOT NULL,
	CONSTRAINT "tees_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"apple_sub" text,
	"google_sub" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_apple_sub_unique" UNIQUE("apple_sub"),
	CONSTRAINT "users_google_sub_unique" UNIQUE("google_sub")
);
