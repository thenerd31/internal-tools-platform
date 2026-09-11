import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config — no providers, no db imports. Middleware uses this;
 * src/platform/auth/index.ts adds providers (which need better-sqlite3).
 */
/**
 * Resolves the session secret. Dev/test fall back to a constant so a fresh
 * clone runs with zero setup; production refuses to start without AUTH_SECRET.
 */
export function resolveSecret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required when NODE_ENV=production");
  }
  return "dev-only-insecure-secret";
}

export const authConfig = {
  secret: resolveSecret(),
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
