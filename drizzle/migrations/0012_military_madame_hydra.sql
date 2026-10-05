CREATE TABLE "session_activity" (
	"sid" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"last_activity" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expired_logged" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session_activity" ADD CONSTRAINT "session_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_activity_last_activity_idx" ON "session_activity" USING btree ("last_activity");--> statement-breakpoint
CREATE INDEX "session_activity_user_id_idx" ON "session_activity" USING btree ("user_id");