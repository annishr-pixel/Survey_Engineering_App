import { handlers } from "@/lib/auth";

// Credentials authorize uses Argon2 (native) — must run on Node, not Edge.
export const runtime = "nodejs";

export const { GET, POST } = handlers;
