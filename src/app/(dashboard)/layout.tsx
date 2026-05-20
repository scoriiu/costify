import { getSessionUser } from "@/modules/auth/session";
import { parseUserRole } from "@/modules/roles";
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

  // OWNERs do not see the accountant dashboard (clients list, internal tools).
  // They have their own surface at /firma. The identity decides the UI.
  if (parseUserRole(user.userRole) === "OWNER") {
    redirect("/firma");
  }

  return (
    <div className="min-h-screen">
      <TopNav userName={user.name} userEmail={user.email} />
      <main>{children}</main>
      <CostiChat />
    </div>
  );
}
