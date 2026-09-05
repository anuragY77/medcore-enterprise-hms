CREATE TABLE "insurance_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" varchar(20) NOT NULL,
	"patient_id" uuid NOT NULL,
	"invoice_id" uuid,
	"provider_name" varchar(200) NOT NULL,
	"policy_number" varchar(100) NOT NULL,
	"claim_amount" real NOT NULL,
	"approved_amount" real,
	"status" varchar(30) NOT NULL,
	"diagnosis" text,
	"treatment_code" varchar(100),
	"submitted_date" timestamp,
	"processed_date" timestamp,
	"denial_reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "insurance_claims_claim_id_unique" UNIQUE("claim_id")
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" varchar(20) NOT NULL,
	"name" varchar(200) NOT NULL,
	"category" varchar(100) NOT NULL,
	"description" text,
	"supplier" varchar(200),
	"quantity" integer NOT NULL,
	"reorder_level" integer,
	"unit" varchar(50) NOT NULL,
	"unit_price" real,
	"location" varchar(200),
	"status" varchar(30) NOT NULL,
	"last_restocked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_items_item_id_unique" UNIQUE("item_id")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar(20) NOT NULL,
	"patient_id" uuid NOT NULL,
	"appointment_id" uuid,
	"description" text,
	"subtotal" real NOT NULL,
	"tax_amount" real,
	"discount_amount" real,
	"total_amount" real NOT NULL,
	"paid_amount" real,
	"status" varchar(30) NOT NULL,
	"payment_method" varchar(50),
	"paid_date" timestamp,
	"due_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_id_unique" UNIQUE("invoice_id")
);
--> statement-breakpoint
CREATE TABLE "lab_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" varchar(20) NOT NULL,
	"patient_id" uuid NOT NULL,
	"consultation_id" uuid,
	"test_name" varchar(200) NOT NULL,
	"category" varchar(100) NOT NULL,
	"ordered_by" varchar(200),
	"status" varchar(30) NOT NULL,
	"result" text,
	"notes" text,
	"test_date" timestamp NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lab_tests_test_id_unique" UNIQUE("test_id")
);
--> statement-breakpoint
CREATE TABLE "pharmacy_medicines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"medicine_id" varchar(20) NOT NULL,
	"name" varchar(200) NOT NULL,
	"generic_name" varchar(200),
	"category" varchar(100) NOT NULL,
	"manufacturer" varchar(200),
	"description" text,
	"dosage" varchar(100),
	"unit" varchar(50) NOT NULL,
	"stock_quantity" integer NOT NULL,
	"reorder_level" integer,
	"unit_price" real,
	"expiry_date" timestamp,
	"status" varchar(30) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pharmacy_medicines_medicine_id_unique" UNIQUE("medicine_id"),
	CONSTRAINT "pharmacy_medicines_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_tests" ADD CONSTRAINT "lab_tests_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_tests" ADD CONSTRAINT "lab_tests_consultation_id_consultations_id_fk" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE set null ON UPDATE no action;