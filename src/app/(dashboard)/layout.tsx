import { getSessionUser } from "@/modules/auth/session";
import { redirect } from "next/navigation";
import { TopNav } from "@/components/layout/topnav";
import { CostiChat } from "@/components/costi/costi-chat";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <TopNav userName={user.name} userEmail={user.email} />
      <main>{children}</main>
      <CostiChat />
    </div>
  );
}
