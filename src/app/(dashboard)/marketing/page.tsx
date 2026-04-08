import { getSessionUser } from "@/modules/auth/session";
import { redirect } from "next/navigation";
import { MarketingStrategy } from "@/components/marketing/marketing-strategy";

export default async function MarketingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return <MarketingStrategy />;
}
