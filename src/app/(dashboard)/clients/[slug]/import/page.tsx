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
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
      <ImportWizard clientId={client.id} clientSlug={client.slug} clientName={client.name} />
    </div>
  );
}
