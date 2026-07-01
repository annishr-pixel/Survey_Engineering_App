import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Enum value tuples (kept in sync with lib/db/schema.ts pgEnums)      */
/* ------------------------------------------------------------------ */

export const ROOF_TYPES = ["concrete_tile", "slate", "flat", "metal", "asbestos"] as const;
export const MAIN_FUSE_RATINGS = ["60A", "80A", "100A", "other"] as const;
export const DNO_CONNECTIONS = ["G98", "G99"] as const;
export const MOUNT_TYPES = ["roof", "ground"] as const;
export const BUILDING_REGS_PARTS = ["A", "B", "C", "L", "P"] as const;

/* ------------------------------------------------------------------ */
/* Coercion helpers — empty form values become `undefined`            */
/* ------------------------------------------------------------------ */

const emptyToUndef = (v: unknown) => (v === "" || v === null ? undefined : v);

const optInt = z.preprocess(emptyToUndef, z.coerce.number().int().optional());
const optNum = z.preprocess(emptyToUndef, z.coerce.number().optional());
const optStr = z.preprocess(emptyToUndef, z.string().trim().optional());

const optBool = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return undefined;
  if (v === true || v === "true") return true;
  if (v === false || v === "false") return false;
  return v;
}, z.boolean().optional());

const optEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(emptyToUndef, z.enum(values).optional());

/* ------------------------------------------------------------------ */
/* Typed (sales-queryable) columns                                     */
/* ------------------------------------------------------------------ */

const columnFields = {
  // 3.2 Site access
  scaffoldFront: optBool,
  scaffoldRear: optBool,
  scaffoldGable: optBool,
  scaffoldPermitRequired: optBool,

  // 3.3 Roof / structure / shading
  roofType: optEnum(ROOF_TYPES),
  roofPitchDeg: optInt,
  roofAzimuthDeg: optInt,
  rafterThicknessMm: optInt,
  rafterSpacingMm: optInt,
  rotPresent: optBool,
  multipleRoofFaces: optBool,
  roofFaceCount: optInt,
  mountType: optEnum(MOUNT_TYPES),

  // 3.4 Technical design & hardware
  viableSystemKw: optNum,
  panelWattageW: optInt,
  panelQuantity: optInt,
  inverterQuantity: optInt,
  batteryCapacityKwh: optNum,
  pas63100Compliant: optBool,
  dcCableLengthM: optInt,
  acCableLengthM: optInt,
  consumerUnitSpareWays: optInt,
  mainFuseRating: optEnum(MAIN_FUSE_RATINGS),
  loopedSupply: optBool,
  smets2Present: optBool,
  wifiStrength: optStr,

  // 3.5 Labour
  labourManDays: optNum,
  groundworksTrenching: optBool,
  remedialWorks: optBool,

  // 3.6 Compliance
  dnoConnection: optEnum(DNO_CONNECTIONS),
  exportLimitation: optBool,
  planningPermissionRequired: optBool,
  listedBuilding: optBool,
  article4: optBool,
  buildingRegsParts: z.preprocess(
    (v) => (v == null ? undefined : v),
    z.array(z.enum(BUILDING_REGS_PARTS)).optional(),
  ),
  mcsApplicable: optBool,

  // 3.7 Financial
  estimatedYieldKwh: optInt,
  cuUpgradeRequired: optBool,
  treeTrimmingRequired: optBool,
  dnoFeesExpected: optBool,
  planningFeesExpected: optBool,

  // 3.8 Risk
  asbestosPresent: optBool,
  showstopperPresent: optBool,
  evFuture: optBool,
  heatpumpFuture: optBool,
  epsBackup: optBool,
};

/* ------------------------------------------------------------------ */
/* Narrative / free-text fields → stored in surveys.extras (JSONB)     */
/* ------------------------------------------------------------------ */

export const EXTRAS_KEYS = [
  "parkingNotes",
  "scaffoldingNotes",
  "workingHoursNotes",
  "materialStorageNotes",
  "structuralNotes",
  "shadingNotes",
  "groundMountNotes",
  "panelSpecNotes",
  "inverterType",
  "inverterLocation",
  "inverterVentilationNotes",
  "wiringRouteNotes",
  "containmentNotes",
  "boardConditionNotes",
  "specialistSkillsNotes",
  "premiumLabourNotes",
  "groundworksNotes",
  "travelLogisticsNotes",
  "buildingRegsNotes",
  "planningNotes",
  "electricalComplianceNotes",
  "ramsNotes",
  "usageProfileNotes",
  "tariffNotes",
  "maintenanceAccessNotes",
  "aestheticNotes",
  "redFlagNotes",
  "generalNotes",
] as const;

const extrasShape = Object.fromEntries(
  EXTRAS_KEYS.map((k) => [k, optStr]),
) as Record<(typeof EXTRAS_KEYS)[number], typeof optStr>;

export const extrasSchema = z.object(extrasShape).partial();

/* ------------------------------------------------------------------ */
/* Draft vs submit schemas                                             */
/* ------------------------------------------------------------------ */

export const draftSchema = z.object({
  ...columnFields,
  extras: extrasSchema.optional(),
});

/** Submit requires the three mandatory risk/electrical flags. */
export const submitSchema = draftSchema.superRefine((data, ctx) => {
  if (data.asbestosPresent === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["asbestosPresent"],
      message: "Asbestos assessment is required.",
    });
  }
  if (data.loopedSupply === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["loopedSupply"],
      message: "Looped supply check is required.",
    });
  }
  if (data.mainFuseRating === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["mainFuseRating"],
      message: "Main cutout fuse rating is required.",
    });
  }
});

export type SurveyInput = z.infer<typeof draftSchema>;
export type SurveyExtras = z.infer<typeof extrasSchema>;

/** The three fields that must be set before a survey can be submitted. */
export const MANDATORY_FIELDS = [
  "asbestosPresent",
  "loopedSupply",
  "mainFuseRating",
] as const;
