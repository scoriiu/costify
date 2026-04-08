import { DesignSystem } from "@/components/design/design-system";
import { getSessionUser } from "@/modules/auth/session";
import { redirect } from "next/navigation";

export default async function DesignPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return <DesignSystem />;
}
