import { getSessionUser } from "@/modules/auth/session";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { CostiChat } from "@/components/costi/costi-chat";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar userName={user.name} />
      <main className="ml-60 flex-1">{children}</main>
      <CostiChat />
    </div>
  );
}
