import { getSessionUser } from "@/modules/auth/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ClientList } from "@/components/clients/client-list";

export default async function ClientsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const clients = await prisma.client.findMany({
    where: { userId: user.id, active: true },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: { journalLines: { where: { deletedAt: null } } },
      },
      publishedPeriods: {
        orderBy: [{ year: "desc" }, { month: "desc" }],
        take: 1,
        select: { year: true, month: true, publishedAt: true, staleSince: true },
      },
    },
  });

  const items = clients.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    cui: c.cui,
    caen: c.caen,
    entryCount: c._count.journalLines,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    verticalsEnabled: c.verticalsEnabled,
    latestPublished: c.publishedPeriods[0]
      ? {
          year: c.publishedPeriods[0].year,
          month: c.publishedPeriods[0].month,
          publishedAt: c.publishedPeriods[0].publishedAt.toISOString(),
          isStale: c.publishedPeriods[0].staleSince !== null,
        }
      : null,
  }));

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-7xl mx-auto">
      <ClientList clients={items} />
    </div>
  );
}
