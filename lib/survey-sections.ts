/**
 * Declarative survey form definition. Field `name` is the react-hook-form path:
 * typed columns are top-level (e.g. "roofType"); narrative fields are nested
 * under "extras.*" and land in surveys.extras (JSONB). Section "3.1" is the
 * read-only Notion data and is rendered separately, so it is not listed here.
 */

export type FieldType = "text" | "textarea" | "number" | "int" | "bool" | "enum" | "multi";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  hint?: string;
  /** Mandatory before submission. */
  required?: boolean;
}

export interface SectionDef {
  id: string;
  title: string;
  fields: FieldDef[];
}

const ROOF_TYPE_OPTIONS = [
  { value: "concrete_tile", label: "Concrete Tile" },
  { value: "slate", label: "Slate" },
  { value: "flat", label: "Flat (Felt/EPDM/Fibreglass)" },
  { value: "metal", label: "Metal (Trapezoidal/Standing Seam)" },
  { value: "asbestos", label: "Asbestos / Fibrocement" },
];

const MOUNT_TYPE_OPTIONS = [
  { value: "roof", label: "On / In-roof" },
  { value: "ground", label: "Ground-mount" },
];

const FUSE_OPTIONS = [
  { value: "60A", label: "60A" },
  { value: "80A", label: "80A" },
  { value: "100A", label: "100A" },
  { value: "other", label: "Other / Unknown" },
];

const DNO_OPTIONS = [
  { value: "G98", label: "G98 (≤3.68kW/phase — connect & notify)" },
  { value: "G99", label: "G99 (>3.68kW/phase — prior approval)" },
];

const BUILDING_REGS_OPTIONS = [
  { value: "A", label: "Part A (Structural)" },
  { value: "B", label: "Part B (Fire)" },
  { value: "C", label: "Part C (Moisture)" },
  { value: "L", label: "Part L (Fuel/Power)" },
  { value: "P", label: "Part P (Electrical)" },
];

export const SECTIONS: SectionDef[] = [
  {
    id: "3.2",
    title: "Site Access & Logistics",
    fields: [
      { name: "extras.parkingNotes", label: "Parking constraints", type: "textarea", hint: "Driveway, pavement parking, council permits / bay suspensions for vans." },
      { name: "scaffoldFront", label: "Scaffold: front access", type: "bool" },
      { name: "scaffoldRear", label: "Scaffold: rear access", type: "bool" },
      { name: "scaffoldGable", label: "Scaffold: gable access", type: "bool" },
      { name: "extras.scaffoldingNotes", label: "Scaffolding obstructions", type: "textarea", hint: "Conservatories, fragile roofs, narrow alleys." },
      { name: "scaffoldPermitRequired", label: "Scaffold on public highway (street licence required)?", type: "bool" },
      { name: "extras.workingHoursNotes", label: "Working hours / access constraints", type: "textarea", hint: "School zones, commercial hours, noise restrictions, gate codes." },
      { name: "extras.materialStorageNotes", label: "Material storage", type: "textarea", hint: "Secure, dry area for panels/batteries/rails on multi-day installs." },
    ],
  },
  {
    id: "3.3",
    title: "Roof, Structure & Shading",
    fields: [
      { name: "roofType", label: "Roof type & covering", type: "enum", options: ROOF_TYPE_OPTIONS },
      { name: "roofPitchDeg", label: "Pitch angle (°)", type: "int" },
      { name: "roofAzimuthDeg", label: "Orientation / azimuth (°)", type: "int" },
      { name: "rafterThicknessMm", label: "Rafter thickness (mm)", type: "int" },
      { name: "rafterSpacingMm", label: "Rafter spacing (mm)", type: "int" },
      { name: "rotPresent", label: "Signs of rot / sagging?", type: "bool" },
      { name: "extras.structuralNotes", label: "Structural integrity notes", type: "textarea", hint: "Building Regs Part A considerations." },
      { name: "multipleRoofFaces", label: "Array split across multiple faces?", type: "bool" },
      { name: "roofFaceCount", label: "Number of roof faces", type: "int" },
      { name: "extras.shadingNotes", label: "Shading analysis (year-round)", type: "textarea", hint: "Trees, chimneys, dormers, neighbours. Optimisers/microinverters needed?" },
      { name: "mountType", label: "Mounting", type: "enum", options: MOUNT_TYPE_OPTIONS },
      { name: "extras.groundMountNotes", label: "Ground-mount details (if applicable)", type: "textarea", hint: "Soil type, distance to CU, trench route, concrete base." },
    ],
  },
  {
    id: "3.4",
    title: "Technical Design & Hardware",
    fields: [
      { name: "viableSystemKw", label: "Viable system size (kW)", type: "number" },
      { name: "extras.panelSpecNotes", label: "Panel specifications", type: "textarea", hint: "Type (mono/glass-glass), dimensions, mounting (in/on-roof/ballasted)." },
      { name: "panelWattageW", label: "Panel wattage (W)", type: "int" },
      { name: "panelQuantity", label: "Panel quantity", type: "int" },
      { name: "extras.inverterType", label: "Inverter type", type: "text", hint: "String / Microinverters / Optimisers." },
      { name: "inverterQuantity", label: "Inverter quantity", type: "int" },
      { name: "extras.inverterLocation", label: "Inverter mounting location", type: "text", hint: "Loft, garage, utility." },
      { name: "extras.inverterVentilationNotes", label: "Inverter environment / ventilation", type: "textarea", hint: "Lofts can exceed 40°C, de-rating the inverter." },
      { name: "batteryCapacityKwh", label: "Battery capacity (kWh)", type: "number" },
      { name: "pas63100Compliant", label: "Battery location PAS 63100 compliant?", type: "bool", hint: "Clearances, away from escape routes, fire-boarding, ambient temp." },
      { name: "extras.wiringRouteNotes", label: "Wiring & cabling route", type: "textarea", hint: "Roof → inverter → consumer unit." },
      { name: "dcCableLengthM", label: "Estimated DC cable length (m)", type: "int" },
      { name: "acCableLengthM", label: "Estimated AC cable length (m)", type: "int" },
      { name: "extras.containmentNotes", label: "Containment & penetrations", type: "text", hint: "Conduit/trunking/tray; number of penetrations." },
      { name: "extras.boardConditionNotes", label: "Consumer unit condition", type: "textarea", hint: "Metal vs plastic, BS 7671 18th Edition compliant?" },
      { name: "consumerUnitSpareWays", label: "Spare ways available", type: "int" },
      { name: "mainFuseRating", label: "Main cutout fuse rating", type: "enum", options: FUSE_OPTIONS, required: true },
      { name: "loopedSupply", label: "Looped supply (shared incoming mains with neighbour)?", type: "bool", required: true, hint: "Critical DNO flag." },
      { name: "smets2Present", label: "SMETS2 smart meter present?", type: "bool" },
      { name: "wifiStrength", label: "Wi-Fi signal at inverter location", type: "text", hint: "Hardwired data cable / Wi-Fi extender needed?" },
    ],
  },
  {
    id: "3.5",
    title: "Labour, Installation & Operational Costs",
    fields: [
      { name: "labourManDays", label: "Total man-days required", type: "number" },
      { name: "extras.specialistSkillsNotes", label: "Specialist skills needed", type: "textarea", hint: "Slate roofer, commercial electrician, groundworker." },
      { name: "extras.premiumLabourNotes", label: "Premium labour", type: "text", hint: "Weekend / overnight / out-of-hours." },
      { name: "groundworksTrenching", label: "Groundworks / trenching required?", type: "bool" },
      { name: "extras.groundworksNotes", label: "Groundworks detail", type: "textarea", hint: "Trench length, ducting, backfill, reinstatement." },
      { name: "remedialWorks", label: "Remedial works required (pre/post install)?", type: "bool" },
      { name: "extras.travelLogisticsNotes", label: "Travel & logistics", type: "textarea", hint: "Distance, fuel, accommodation, lifting equipment hire." },
    ],
  },
  {
    id: "3.6",
    title: "Compliance, Regulations & Approvals",
    fields: [
      { name: "dnoConnection", label: "DNO connection type", type: "enum", options: DNO_OPTIONS },
      { name: "exportLimitation", label: "Export limitation device required by DNO?", type: "bool" },
      { name: "buildingRegsParts", label: "Building Regs parts engaged", type: "multi", options: BUILDING_REGS_OPTIONS },
      { name: "extras.buildingRegsNotes", label: "Building Regs notes", type: "textarea" },
      { name: "planningPermissionRequired", label: "Planning permission required (not permitted development)?", type: "bool" },
      { name: "listedBuilding", label: "Listed building?", type: "bool" },
      { name: "article4", label: "Conservation area / Article 4 direction?", type: "bool" },
      { name: "extras.planningNotes", label: "Planning notes", type: "textarea" },
      { name: "extras.electricalComplianceNotes", label: "Electrical compliance", type: "textarea", hint: "EIC and Building Control notification requirements." },
      { name: "mcsApplicable", label: "Meets MCS standards (SEG eligible)?", type: "bool" },
      { name: "extras.ramsNotes", label: "Health & Safety / RAMS flags", type: "textarea", hint: "Working at height, fragile roofs, manual handling." },
    ],
  },
  {
    id: "3.7",
    title: "Financial & Operational Considerations",
    fields: [
      { name: "estimatedYieldKwh", label: "Estimated annual yield (kWh)", type: "int", hint: "MCS calculation method." },
      { name: "extras.usageProfileNotes", label: "Customer usage profile", type: "textarea", hint: "Day vs night, peak-load. Justifies battery sizing." },
      { name: "extras.tariffNotes", label: "Tariffs & incentives", type: "text", hint: "Octopus Agile/Flux, EV/solar tariffs." },
      { name: "extras.maintenanceAccessNotes", label: "Maintenance accessibility", type: "textarea", hint: "Safe panel cleaning / inverter servicing access." },
      { name: "treeTrimmingRequired", label: "Tree trimming needed?", type: "bool" },
      { name: "cuUpgradeRequired", label: "Consumer unit upgrade required?", type: "bool" },
      { name: "dnoFeesExpected", label: "DNO application / network upgrade fees expected?", type: "bool" },
      { name: "planningFeesExpected", label: "Planning application fees expected?", type: "bool" },
    ],
  },
  {
    id: "3.8",
    title: "Out-of-the-Box & Risk Considerations",
    fields: [
      { name: "evFuture", label: "Future EV charger of interest?", type: "bool" },
      { name: "heatpumpFuture", label: "Future heat pump of interest?", type: "bool" },
      { name: "epsBackup", label: "Wants resilience / EPS backup power?", type: "bool", hint: "Requires earthing upgrades, critical-load circuits, specific inverter." },
      { name: "extras.aestheticNotes", label: "Aesthetic impact & neighbour disputes", type: "textarea", hint: "Glare, all-black system, disguised wiring." },
      { name: "asbestosPresent", label: "Asbestos present?", type: "bool", required: true, hint: "Confirmed asbestos requires specialist removal." },
      { name: "showstopperPresent", label: "Showstopper / red flag present?", type: "bool", hint: "Condemned roof, uncooperative DNO, budget mismatch." },
      { name: "extras.redFlagNotes", label: "Showstopper / red flag details", type: "textarea" },
      { name: "extras.generalNotes", label: "General notes", type: "textarea" },
    ],
  },
];
