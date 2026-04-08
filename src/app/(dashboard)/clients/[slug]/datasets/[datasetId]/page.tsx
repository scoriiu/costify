import { getSessionUser } from "@/modules/auth/session";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getBalanceRows, getDatasetPeriods } from "@/modules/balances";
import { computeKpis } from "@/modules/reporting";
import { computeCpp } from "@/modules/reporting";
import { DatasetView } from "@/components/datasets/dataset-view";

interface Props {
  params: Promise<{ slug: string; datasetId: string }>;
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function DatasetDetailPage(props: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { slug, datasetId } = await props.params;
  const searchParams = await props.searchParams;

  const client = await prisma.client.findFirst({
    where: { userId: user.id, slug, active: true },
    select: { id: true, name: true, slug: true },
  });
  if (!client) notFound();

  const dataset = await prisma.dataset.findFirst({
    where: { id: datasetId, clientId: client.id },
    select: { id: true, name: true, fileName: true, status: true, createdAt: true },
  });
  if (!dataset) notFound();

  const periods = await getDatasetPeriods(datasetId);
  if (periods.length === 0) notFound();

  const lastPeriod = periods[periods.length - 1];
  const year = searchParams.year ? parseInt(searchParams.year) : lastPeriod.year;
  const month = searchParams.month ? parseInt(searchParams.month) : lastPeriod.month;

  const balanceResult = await getBalanceRows({ datasetId, year, month });
  if (!balanceResult.ok) notFound();

  const kpis = computeKpis(balanceResult.data);
  const cpp = computeCpp(balanceResult.data);

  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <DatasetView
        client={{ slug: client.slug, name: client.name }}
        dataset={{
          id: dataset.id,
          name: dataset.name,
          fileName: dataset.fileName,
          createdAt: dataset.createdAt.toISOString(),
        }}
        periods={periods}
        selectedYear={year}
        selectedMonth={month}
        balanceRows={balanceResult.data}
        kpis={kpis}
        cpp={cpp}
      />
    </div>
  );
}
