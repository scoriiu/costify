"use server";

import { redirect } from "next/navigation";
import { destroySession } from "@/modules/auth/session";

export async function destroySessionAction() {
  await destroySession();
  redirect("/login");
}
