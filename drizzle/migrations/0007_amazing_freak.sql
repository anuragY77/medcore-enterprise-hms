CREATE TABLE "emergency_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" varchar(20) NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid,
	"arrival_time" timestamp NOT NULL,
	"triage_level" integer NOT NULL,
	"status" varchar(30) NOT NULL,
	"chief_complaint" text NOT NULL,
	"diagnosis" text,
	"treatment" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "emergency_cases_case_id_unique" UNIQUE("case_id")
);
--> statement-breakpoint
ALTER TABLE "emergency_cases" ADD CONSTRAINT "emergency_cases_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emergency_cases" ADD CONSTRAINT "emergency_cases_doctor_id_staff_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;