"use client";

import { useActionState } from "react";
import { registerAction } from "@/modules/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, {});

  return (
    <form action={action} className="space-y-5">
      {state.error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {state.error}
        </div>
      )}

      <Input
        id="name"
        name="name"
        type="text"
        label="Name"
        placeholder="Your full name"
        required
        autoComplete="name"
        autoFocus
      />

      <Input
        id="email"
        name="email"
        type="email"
        label="Email"
        placeholder="contabil@firma.ro"
        required
        autoComplete="email"
      />

      <Input
        id="password"
        name="password"
        type="password"
        label="Password"
        placeholder="Minimum 8 characters"
        required
        minLength={8}
        autoComplete="new-password"
      />

      <Input
        id="confirmPassword"
        name="confirmPassword"
        type="password"
        label="Confirm Password"
        placeholder="Repeat your password"
        required
        minLength={8}
        autoComplete="new-password"
      />

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account..." : "Create Account"}
      </Button>

      <p className="text-center text-sm text-gray">
        Already have an account?{" "}
        <Link href="/login" className="text-primary-light hover:text-white transition-colors">
          Login
        </Link>
      </p>
    </form>
  );
}
