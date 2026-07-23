/**
 * Central mapping of the app's logical fields to the actual Notion column names.
 *
 * When the Notion databases are renamed or their columns change, update the
 * string values here — this is the ONE place property names live, so the rest
 * of the code never hard-codes a column name. Verified against the live
 * databases on 2026-07-23 (run `scripts/notion-diagnose.ts` to re-verify).
 */

/** "Treadlighter Website Enquiry" database columns. */
export const ENQ = {
  customerName: "Customer Name", // title
  email: "Email", // rich_text
  phone: "Phone No", // phone_number
  jobId: "Job ID", // rich_text
  status: "Status", // select
  approval: "Client Approval", // select (app writes "Y"/"N")
  serviceInterested: "Service Interested", // multi_select
  estimatedAmount: "Initial Estimation Amount", // number
  reasonForRejection: "Reason for Rejection", // rich_text
} as const;

/** "Customer Details" database columns. */
export const CUST = {
  customerName: "Customer Name", // title
  jobId: "Job ID", // rich_text
  address: "Customer Address", // rich_text
  email: "Email", // email
  phone: "Phone No", // phone_number
  domesticCommercial: "Domestic/Commercial", // rich_text
  annualConsumption: "Annual Energy Consumption", // rich_text
  currentElectricityPrice: "Current Electricity Price", // rich_text
  pvInstalled: "PV Installed(Y/N)", // select (Yes/No)
  fitArrangement: "FIT Arrangement(Y/N)", // select (Yes/No/N/A)
  conservationArea: "Conservation area(Y/N)", // select (Yes/No)
  councilDetails: "Council details", // rich_text
  evAshp: "EV/ASHP/Electric Boiler/All", // select
  solarPreferences: "Preferences of Solar Panel", // rich_text
  preferredTimeframe: "Preferred timeframe", // rich_text
  batteryStoragePrice: "Battery Storage Price(Y/N)", // select
  plansDrawings: "Plans/Drawring", // rich_text
  turnkey: "Turnkey Installation(Y/N)", // select
  roofMakeup: "Roof Make-Up", // rich_text
  status: "Status", // select
} as const;

/**
 * Ordered list of Customer Details columns shown on the exported PDF
 * (label = the Notion column name). Kept explicit so the PDF layout is stable
 * regardless of Notion's property ordering.
 */
export const CUST_PDF_FIELDS: string[] = [
  CUST.customerName,
  CUST.jobId,
  CUST.address,
  CUST.email,
  CUST.phone,
  CUST.domesticCommercial,
  CUST.annualConsumption,
  CUST.currentElectricityPrice,
  CUST.pvInstalled,
  CUST.fitArrangement,
  CUST.conservationArea,
  CUST.councilDetails,
  CUST.evAshp,
  CUST.solarPreferences,
  CUST.preferredTimeframe,
  CUST.batteryStoragePrice,
  CUST.turnkey,
  CUST.roofMakeup,
  CUST.plansDrawings,
  CUST.status,
];

/** Value written to the Enquiries "Client Approval" select. */
export const APPROVAL_YES = "Y";
export const APPROVAL_NO = "N";
