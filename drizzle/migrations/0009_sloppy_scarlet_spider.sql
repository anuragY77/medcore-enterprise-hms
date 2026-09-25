CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"type" varchar(30) DEFAULT 'SYSTEM' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"action" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_recipient_id_idx" ON "notifications" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_recipient_is_read_idx" ON "notifications" USING btree ("recipient_id","is_read","created_at");