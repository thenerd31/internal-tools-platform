import NextAuth from "next-auth";
import type { Actor } from "../types";
import { authConfig } from "./config";
import { buildProviders } from "./providers";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: buildProviders(),
});

export async function getActor(): Promise<Actor | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.role) return null;
  return {
    id: user.id,
    email: user.email ?? "",
    name: user.name ?? "",
    role: user.role,
  };
}
