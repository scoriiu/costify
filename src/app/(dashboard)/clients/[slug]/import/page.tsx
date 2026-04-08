import { getSessionUser } from "@/modules/auth/session";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ImportWizard } from "@/components/import/import-wizard";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ImportPage(props: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { slug } = await props.params;

  const client = await prisma.client.findFirst({
    where: { userId: user.id, slug, active: true },
  });

  if (!client) notFound();

  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <h1 className="text-[28px] font-semibold text-white mb-8" style={{ letterSpacing: "-0.04em" }}>Import — {client.name}</h1>
      <ImportWizard clientId={client.id} clientSlug={client.slug} />
    </div>
  );
}
