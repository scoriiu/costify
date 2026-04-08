import { getSessionUser } from "@/modules/auth/session";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ClientDashboard } from "@/components/clients/client-dashboard";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ClientDetailPage(props: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { slug } = await props.params;

  const client = await prisma.client.findFirst({
    where: { userId: user.id, slug, active: true },
    include: {
      datasets: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!client) notFound();

  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <h1 className="text-[28px] font-semibold text-white mb-8" style={{ letterSpacing: "-0.04em" }}>{client.name}</h1>
      <ClientDashboard
          client={{
            id: client.id,
            slug: client.slug,
            name: client.name,
            cui: client.cui,
            caen: client.caen,
          }}
          datasets={client.datasets.map((d) => ({
            id: d.id,
            name: d.name,
            fileName: d.fileName,
            sourceType: d.sourceType,
            status: d.status,
            createdAt: d.createdAt.toISOString(),
          }))}
        />
    </div>
  );
}
