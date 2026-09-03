CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" varchar(20) NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_name" varchar(200) NOT NULL,
	"department" varchar(100) NOT NULL,
	"date" timestamp NOT NULL,
	"time" varchar(20) NOT NULL,
	"type" varchar(50) NOT NULL,
	"status" varchar(20) NOT NULL,
	"reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_appointment_id_unique" UNIQUE("appointment_id")
);
--> statement-breakpoint
CREATE TABLE "beds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bed_id" varchar(20) NOT NULL,
	"room_number" varchar(20) NOT NULL,
	"department" varchar(100) NOT NULL,
	"ward" varchar(100),
	"type" varchar(50) NOT NULL,
	"status" varchar(20) NOT NULL,
	"patient_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "beds_bed_id_unique" UNIQUE("bed_id")
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"head_doctor" varchar(200),
	"phone" varchar(20),
	"location" varchar(200),
	"total_beds" integer,
	"status" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "departments_department_id_unique" UNIQUE("department_id"),
	CONSTRAINT "departments_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beds" ADD CONSTRAINT "beds_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;