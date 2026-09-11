"use client";

import { useActionState } from "react";
import { login } from "@/platform/auth/actions";
import { Button } from "@/platform/ui/button";
import { Input } from "@/platform/ui/input";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Email
        <Input name="email" type="email" required autoComplete="username" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <Input name="password" type="password" required autoComplete="current-password" />
      </label>
      {state?.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        Sign in
      </Button>
    </form>
  );
}
