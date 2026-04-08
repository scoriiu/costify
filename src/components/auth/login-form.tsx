"use client";

import { useActionState } from "react";
import { loginAction } from "@/modules/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {});

  return (
    <form action={action} className="space-y-5">
      {state.error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {state.error}
        </div>
      )}

      <Input
        id="email"
        name="email"
        type="email"
        label="Email"
        placeholder="contabil@firma.ro"
        required
        autoComplete="email"
        autoFocus
      />

      <Input
        id="password"
        name="password"
        type="password"
        label="Parola"
        placeholder="Introdu parola"
        required
        autoComplete="current-password"
      />

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Se autentifica..." : "Autentificare"}
      </Button>
    </form>
  );
}
