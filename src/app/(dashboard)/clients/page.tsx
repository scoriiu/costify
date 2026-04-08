import { getSessionUser } from "@/modules/auth/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ClientList } from "@/components/clients/client-list";

export default async function ClientsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const clients = await prisma.client.findMany({
    where: { userId: user.id, active: true },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { journalLines: { where: { deletedAt: null } } } } },
  });

  const items = clients.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    cui: c.cui,
    caen: c.caen,
    entryCount: c._count.journalLines,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
      <ClientList clients={items} />
    </div>
  );
}
