import "server-only";
import { Client } from "@notionhq/client";
import { env } from "@/lib/env";

export const notion = new Client({ auth: env.NOTION_TOKEN });

/**
 * Second client pinned to the data-source API (2025-09-03+). Required to query
 * databases that expose multiple data sources (the Enquiries DB picked up a
 * stray second data source). The default client above stays on 2022-06-28 for
 * page updates and single-source queries that already work.
 */
export const notionDataSources = new Client({
  auth: env.NOTION_TOKEN,
  notionVersion: "2025-09-03",
});
