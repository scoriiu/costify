import { getSessionUser } from "@/modules/auth/session";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const user = await getSessionUser();
  if (user) redirect("/clients");
  redirect("/login");
}
