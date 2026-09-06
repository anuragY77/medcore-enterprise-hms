CREATE TABLE "surgeries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"surgery_id" varchar(20) NOT NULL,
	"patient_id" uuid NOT NULL,
	"surgeon_id" uuid NOT NULL,
	"procedure_name" varchar(200) NOT NULL,
	"procedure_type" varchar(100) NOT NULL,
	"surgery_date" timestamp NOT NULL,
	"estimated_duration" integer,
	"operating_room" varchar(50),
	"department" varchar(100) NOT NULL,
	"status" varchar(30) NOT NULL,
	"pre_op_notes" text,
	"post_op_notes" text,
	"complications" text,
	"anesthesia_type" varchar(50),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "surgeries_surgery_id_unique" UNIQUE("surgery_id")
);
--> statement-breakpoint
ALTER TABLE "surgeries" ADD CONSTRAINT "surgeries_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surgeries" ADD CONSTRAINT "surgeries_surgeon_id_staff_id_fk" FOREIGN KEY ("surgeon_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;