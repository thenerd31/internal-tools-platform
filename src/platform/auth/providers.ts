import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { users } from "../db/schema";
import type { Role } from "../types";

/** Credentials for dev always; OIDC registered only when AUTH_OIDC_ISSUER is set. */
export function buildProviders(): Provider[] {
  const providers: Provider[] = [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").toLowerCase();
        const password = String(credentials?.password ?? "");
        const user = getDb()
          .select()
          .from(users)
          .where(eq(users.email, email))
          .get();
        if (!user) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as Role,
        };
      },
    }),
  ];
  if (process.env.AUTH_OIDC_ISSUER) {
    providers.push({
      id: "oidc",
      name: "SSO",
      type: "oidc",
      issuer: process.env.AUTH_OIDC_ISSUER,
      clientId: process.env.AUTH_OIDC_CLIENT_ID,
      clientSecret: process.env.AUTH_OIDC_CLIENT_SECRET,
    });
  }
  return providers;
}
