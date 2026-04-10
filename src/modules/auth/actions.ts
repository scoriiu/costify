"use server";

import { prisma } from "@/lib/db";
import { verifyPassword } from "./password";
import { createSession, destroySession } from "./session";
import { loginSchema } from "./validation";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

type ActionResult = { error?: string };

export async function registerAction(
  _prev: ActionResult,
  _formData: FormData
): Promise<ActionResult> {
  return { error: "Registration is currently disabled. Contact admin for access." };
}

export async function loginFormAction(formData: FormData): Promise<void> {
  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    redirect(`/login?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    redirect("/login?error=Email+sau+parola+invalida");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    redirect("/login?error=Email+sau+parola+invalida");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const h = await headers();
  await createSession(
    user.id,
    h.get("x-forwarded-for") ?? undefined,
    h.get("user-agent") ?? undefined
  );

  redirect("/clients");
}

export async function loginAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    return { error: "Email sau parola invalida" };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { error: "Email sau parola invalida" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const h = await headers();
  await createSession(
    user.id,
    h.get("x-forwarded-for") ?? undefined,
    h.get("user-agent") ?? undefined
  );

  redirect("/clients");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
