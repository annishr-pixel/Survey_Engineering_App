CREATE TYPE "public"."dno_connection" AS ENUM('G98', 'G99');--> statement-breakpoint
CREATE TYPE "public"."main_fuse_rating" AS ENUM('60A', '80A', '100A', 'other');--> statement-breakpoint
CREATE TYPE "public"."mount_type" AS ENUM('roof', 'ground');--> statement-breakpoint
CREATE TYPE "public"."property_use" AS ENUM('domestic', 'commercial');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('surveyor', 'sales');--> statement-breakpoint
CREATE TYPE "public"."roof_type" AS ENUM('concrete_tile', 'slate', 'flat', 'metal', 'asbestos');--> statement-breakpoint
CREATE TYPE "public"."survey_status" AS ENUM('draft', 'submitted');--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" text NOT NULL,
	"enquiry_page_id" text NOT NULL,
	"customer_details_page_id" text,
	"customer_name" text,
	"email" text,
	"phone" text,
	"address" text,
	"postcode" text,
	"property_use" "property_use",
	"service_interested" text[],
	"initial_estimated_amount" numeric(10, 2),
	"annual_consumption_kwh" text,
	"current_electricity_price" text,
	"pv_installed" boolean,
	"fit_arrangement" boolean,
	"conservation_area" boolean,
	"council_details" text,
	"notion_status" text,
	"customer_approval" text,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"section" text NOT NULL,
	"blob_url" text NOT NULL,
	"blob_pathname" text NOT NULL,
	"caption" text,
	"content_type" text,
	"size_bytes" integer,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid,
	"job_id" text NOT NULL,
	"surveyor_id" uuid,
	"status" "survey_status" DEFAULT 'draft' NOT NULL,
	"scaffold_front" boolean,
	"scaffold_rear" boolean,
	"scaffold_gable" boolean,
	"scaffold_permit_required" boolean,
	"roof_type" "roof_type",
	"roof_pitch_deg" integer,
	"roof_azimuth_deg" integer,
	"rafter_thickness_mm" integer,
	"rafter_spacing_mm" integer,
	"rot_present" boolean,
	"multiple_roof_faces" boolean,
	"roof_face_count" integer,
	"mount_type" "mount_type",
	"viable_system_kw" real,
	"panel_wattage_w" integer,
	"panel_quantity" integer,
	"inverter_quantity" integer,
	"battery_capacity_kwh" real,
	"pas63100_compliant" boolean,
	"dc_cable_length_m" integer,
	"ac_cable_length_m" integer,
	"consumer_unit_spare_ways" integer,
	"main_fuse_rating" "main_fuse_rating",
	"looped_supply" boolean,
	"smets2_present" boolean,
	"wifi_strength" text,
	"labour_man_days" real,
	"groundworks_trenching" boolean,
	"remedial_works" boolean,
	"dno_connection" "dno_connection",
	"export_limitation" boolean,
	"planning_permission_required" boolean,
	"listed_building" boolean,
	"article_4" boolean,
	"building_regs_parts" text[],
	"mcs_applicable" boolean,
	"estimated_yield_kwh" integer,
	"cu_upgrade_required" boolean,
	"tree_trimming_required" boolean,
	"dno_fees_expected" boolean,
	"planning_fees_expected" boolean,
	"asbestos_present" boolean,
	"showstopper_present" boolean,
	"ev_future" boolean,
	"heatpump_future" boolean,
	"eps_backup" boolean,
	"extras" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notion_pushed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text,
	"role" "role" DEFAULT 'surveyor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_surveyor_id_users_id_fk" FOREIGN KEY ("surveyor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "leads_job_id_unique" ON "leads" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "surveys_job_id_unique" ON "surveys" USING btree ("job_id");