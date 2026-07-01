import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const roleEnum = pgEnum("role", ["surveyor", "sales"]);
export const surveyStatusEnum = pgEnum("survey_status", ["draft", "submitted"]);
export const roofTypeEnum = pgEnum("roof_type", [
  "concrete_tile",
  "slate",
  "flat",
  "metal",
  "asbestos",
]);
export const mainFuseRatingEnum = pgEnum("main_fuse_rating", [
  "60A",
  "80A",
  "100A",
  "other",
]);
export const dnoConnectionEnum = pgEnum("dno_connection", ["G98", "G99"]);
export const propertyUseEnum = pgEnum("property_use", ["domestic", "commercial"]);
export const mountTypeEnum = pgEnum("mount_type", ["roof", "ground"]);

/* ------------------------------------------------------------------ */
/* Users (email/password auth, two roles)                             */
/* ------------------------------------------------------------------ */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  role: roleEnum("role").notNull().default("surveyor"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Leads — cache of joined Notion data (Enquiries + Customer Details) */
/* ------------------------------------------------------------------ */

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Join key across both Notion databases. */
    jobId: text("job_id").notNull(),
    /** Notion page id in the Enquiries DB — needed for status write-back. */
    enquiryPageId: text("enquiry_page_id").notNull(),
    /** Notion page id in the Customer Details DB (may be missing). */
    customerDetailsPageId: text("customer_details_page_id"),

    customerName: text("customer_name"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    postcode: text("postcode"),
    propertyUse: propertyUseEnum("property_use"),
    serviceInterested: text("service_interested").array(),
    initialEstimatedAmount: numeric("initial_estimated_amount", {
      precision: 10,
      scale: 2,
    }),
    annualConsumptionKwh: text("annual_consumption_kwh"),
    currentElectricityPrice: text("current_electricity_price"),
    pvInstalled: boolean("pv_installed"),
    fitArrangement: boolean("fit_arrangement"),
    conservationArea: boolean("conservation_area"),
    councilDetails: text("council_details"),

    notionStatus: text("notion_status"),
    customerApproval: text("customer_approval"),
    /** Reason captured by sales when the customer approval is set to "N". */
    reasonForRejection: text("reason_for_rejection"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    jobIdUnique: uniqueIndex("leads_job_id_unique").on(t.jobId),
  }),
);

/* ------------------------------------------------------------------ */
/* Surveys — wide typed table (sales-queryable) + extras JSONB        */
/* ------------------------------------------------------------------ */

export const surveys = pgTable(
  "surveys",
  {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: uuid("lead_id").references(() => leads.id),
  jobId: text("job_id").notNull(),
  surveyorId: uuid("surveyor_id").references(() => users.id),
  status: surveyStatusEnum("status").notNull().default("draft"),

  /* 3.2 Site access & logistics (queryable subset) */
  scaffoldFront: boolean("scaffold_front"),
  scaffoldRear: boolean("scaffold_rear"),
  scaffoldGable: boolean("scaffold_gable"),
  scaffoldPermitRequired: boolean("scaffold_permit_required"),

  /* 3.3 Roof / structure / shading */
  roofType: roofTypeEnum("roof_type"),
  roofPitchDeg: integer("roof_pitch_deg"),
  roofAzimuthDeg: integer("roof_azimuth_deg"),
  rafterThicknessMm: integer("rafter_thickness_mm"),
  rafterSpacingMm: integer("rafter_spacing_mm"),
  rotPresent: boolean("rot_present"),
  multipleRoofFaces: boolean("multiple_roof_faces"),
  roofFaceCount: integer("roof_face_count"),
  mountType: mountTypeEnum("mount_type"),

  /* 3.4 Technical design & hardware */
  viableSystemKw: real("viable_system_kw"),
  panelWattageW: integer("panel_wattage_w"),
  panelQuantity: integer("panel_quantity"),
  inverterQuantity: integer("inverter_quantity"),
  batteryCapacityKwh: real("battery_capacity_kwh"),
  pas63100Compliant: boolean("pas63100_compliant"),
  dcCableLengthM: integer("dc_cable_length_m"),
  acCableLengthM: integer("ac_cable_length_m"),
  consumerUnitSpareWays: integer("consumer_unit_spare_ways"),
  // Mandatory at submit (enforced via Zod submitSchema).
  mainFuseRating: mainFuseRatingEnum("main_fuse_rating"),
  loopedSupply: boolean("looped_supply"),
  smets2Present: boolean("smets2_present"),
  wifiStrength: text("wifi_strength"),

  /* 3.5 Labour / install / operational */
  labourManDays: real("labour_man_days"),
  groundworksTrenching: boolean("groundworks_trenching"),
  remedialWorks: boolean("remedial_works"),

  /* 3.6 Compliance / regs / approvals */
  dnoConnection: dnoConnectionEnum("dno_connection"),
  exportLimitation: boolean("export_limitation"),
  planningPermissionRequired: boolean("planning_permission_required"),
  listedBuilding: boolean("listed_building"),
  article4: boolean("article_4"),
  buildingRegsParts: text("building_regs_parts").array(),
  mcsApplicable: boolean("mcs_applicable"),

  /* 3.7 Financial / operational */
  estimatedYieldKwh: integer("estimated_yield_kwh"),
  cuUpgradeRequired: boolean("cu_upgrade_required"),
  treeTrimmingRequired: boolean("tree_trimming_required"),
  dnoFeesExpected: boolean("dno_fees_expected"),
  planningFeesExpected: boolean("planning_fees_expected"),

  /* 3.8 Out-of-the-box / risk */
  // Mandatory at submit.
  asbestosPresent: boolean("asbestos_present"),
  showstopperPresent: boolean("showstopper_present"),
  evFuture: boolean("ev_future"),
  heatpumpFuture: boolean("heatpump_future"),
  epsBackup: boolean("eps_backup"),

  /* Narrative / low-query free-text fields */
  extras: jsonb("extras").notNull().default({}),

  /* Notion write-back tracking */
  notionPushed: boolean("notion_pushed").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  },
  (t) => ({
    // One survey per job for the MVP — enables clean upsert.
    jobIdUnique: uniqueIndex("surveys_job_id_unique").on(t.jobId),
  }),
);

/* ------------------------------------------------------------------ */
/* Photos — one row per uploaded image, grouped by survey + section   */
/* ------------------------------------------------------------------ */

export const photos = pgTable("photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  surveyId: uuid("survey_id")
    .notNull()
    .references(() => surveys.id, { onDelete: "cascade" }),
  /** PRD section key, e.g. "3.3". */
  section: text("section").notNull(),
  blobUrl: text("blob_url").notNull(),
  blobPathname: text("blob_pathname").notNull(),
  caption: text("caption"),
  contentType: text("content_type"),
  sizeBytes: integer("size_bytes"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Inferred types                                                      */
/* ------------------------------------------------------------------ */

export type User = typeof users.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type Survey = typeof surveys.$inferSelect;
export type NewSurvey = typeof surveys.$inferInsert;
export type Photo = typeof photos.$inferSelect;
