import "server-only";
import https from "node:https";
import tls from "node:tls";
import { Client } from "@notionhq/client";
import { env } from "@/lib/env";

/**
 * TLS agent that trusts BOTH Node's bundled Mozilla roots (public CAs — used on
 * Vercel) and the OS trust store. Corporate networks here terminate TLS with an
 * intercepting proxy whose root CA lives only in the system store, so without
 * this, requests to api.notion.com fail with "unable to verify the first
 * certificate". @notionhq/client (node-fetch under the hood) forwards `agent`
 * straight to the request.
 */
const notionHttpsAgent = new https.Agent({
  ca: [...tls.getCACertificates("default"), ...tls.getCACertificates("system")],
});

export const notion = new Client({ auth: env.NOTION_TOKEN, agent: notionHttpsAgent });

/**
 * Second client pinned to the data-source API (2025-09-03+). Required to query
 * databases that expose multiple data sources (the Enquiries DB picked up a
 * stray second data source). The default client above stays on 2022-06-28 for
 * page updates and single-source queries that already work.
 */
export const notionDataSources = new Client({
  auth: env.NOTION_TOKEN,
  notionVersion: "2025-09-03",
  agent: notionHttpsAgent,
});
