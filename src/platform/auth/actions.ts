"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from ".";

export async function login(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw e; // NEXT_REDIRECT on success
  }
  return {};
}

export async function logout(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
