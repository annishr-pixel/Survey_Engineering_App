import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config (no DB, no native crypto). Imported by middleware
 * and extended in lib/auth.ts with the Credentials provider (Node-only).
 */
export const authConfig = {
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        (token as any).id = (user as any).id;
        (token as any).role = (user as any).role;
      }
      return token;
    },
    session({ session, token }) {
      const t = token as { id?: string; role?: "surveyor" | "sales" };
      if (t.id) session.user.id = t.id;
      if (t.role && session.user) session.user.role = t.role;
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const role = auth?.user?.role;
      const path = nextUrl.pathname;

      if (path.startsWith("/login")) {
        if (isLoggedIn) {
          const home = role === "sales" ? "/sales" : "/jobs";
          return Response.redirect(new URL(home, nextUrl));
        }
        return true;
      }

      if (!isLoggedIn) return false; // → redirected to signIn page

      // Role gating.
      if (path.startsWith("/sales") && role !== "sales") {
        return Response.redirect(new URL("/jobs", nextUrl));
      }
      if (path.startsWith("/jobs") && role !== "surveyor") {
        return Response.redirect(new URL("/sales", nextUrl));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
