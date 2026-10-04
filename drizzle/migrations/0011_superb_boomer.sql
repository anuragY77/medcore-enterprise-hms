CREATE TABLE "business_id_counters" (
	"prefix" varchar(10) PRIMARY KEY NOT NULL,
	"next_value" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_rate_limits" (
	"key" varchar(200) PRIMARY KEY NOT NULL,
	"fail_count" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp NOT NULL,
	"blocked_until" timestamp
);
--> statement-breakpoint
CREATE INDEX "login_rate_limits_window_idx" ON "login_rate_limits" USING btree ("window_started_at");