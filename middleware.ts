import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Edge-safe instance (no Credentials provider / native crypto pulled in).
export const { auth: middleware } = NextAuth(authConfig);

export default middleware;

export const config = {
  // Protect everything except Next internals, the auth API, and static assets.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
