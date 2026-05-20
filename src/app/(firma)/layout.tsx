import { getSessionUser } from "@/modules/auth/session";
import { redirect } from "next/navigation";
import { CostiChat } from "@/components/costi/costi-chat";

/**
 * Layout for the /firma route group.
 *
 * Does NOT render the standard accountant TopNav. The /firma pages render their
 * own topbar + side nav via OwnerLayout. We only keep Costi available globally.
 */
export default async function FirmaLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <>
      {children}
      <CostiChat />
    </>
  );
}
