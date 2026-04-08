import { getSessionUser } from "@/modules/auth/session";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAvailablePeriods } from "@/modules/balances";
import { ClientDetail } from "@/components/clients/client-detail";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string; year?: string; month?: string }>;
}

export default async function ClientDetailPage(props: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { slug } = await props.params;
  const searchParams = await props.searchParams;

  const client = await prisma.client.findFirst({
    where: { userId: user.id, slug, active: true },
    include: {
      importEvents: { orderBy: { createdAt: "desc" }, take: 10 },
      _count: { select: { journalLines: { where: { deletedAt: null } } } },
    },
  });

  if (!client) notFound();

  const periods = await getAvailablePeriods(client.id);
  const tab = searchParams.tab ?? "jurnal";

  const lastPeriod = periods[periods.length - 1];
  const year = searchParams.year ? parseInt(searchParams.year) : lastPeriod?.year;
  const month = searchParams.month ? parseInt(searchParams.month) : lastPeriod?.month;

  return (
    <ClientDetail
      client={{
        id: client.id,
        slug: client.slug,
        name: client.name,
        cui: client.cui,
        caen: client.caen,
      }}
      entryCount={client._count.journalLines}
      importEvents={client.importEvents.map((e) => ({
        id: e.id,
        fileName: e.fileName,
        entriesAdded: e.entriesAdded,
        dateStart: e.dateStart?.toISOString() ?? null,
        dateEnd: e.dateEnd?.toISOString() ?? null,
        status: e.status,
        createdAt: e.createdAt.toISOString(),
      }))}
      periods={periods}
      activeTab={tab}
      selectedYear={year}
      selectedMonth={month}
    />
  );
}
