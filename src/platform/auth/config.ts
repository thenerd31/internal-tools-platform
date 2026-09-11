import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config — no providers, no db imports. Middleware uses this;
 * src/platform/auth/index.ts adds providers (which need better-sqlite3).
 */
export const authConfig = {
  // AUTH_SECRET in real environments; the fallback exists so a fresh clone
  // can run dev/tests/e2e with zero setup. It only signs local demo sessions.
  secret: process.env.AUTH_SECRET ?? "dev-only-insecure-secret",
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  jwt: { maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id;
      if (token.role) session.user.role = token.role;
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
