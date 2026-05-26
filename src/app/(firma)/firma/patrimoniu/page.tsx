import { redirect } from "next/navigation";
import {
  OwnerLayout,
  PatrimoniuView,
  PageHeader,
  buildOwnerContextForFirma,
  OWNER_PAGES,
} from "@/components/clients/owner";
import { getLatestPublishedView } from "@/modules/publishing";
import { resolveFirmaContext } from "../_lib/resolve-client";
import { recordFirmaAccessAudit } from "../_lib/audit";
import { NoAccessScreen } from "../_lib/no-access";
import { NothingPublishedScreen } from "../_lib/nothing-published";

interface Props {
  searchParams: Promise<{ as?: string; firm?: string }>;
}

export default async function FirmaPatrimoniuPage(props: Props) {
  const { as, firm } = await props.searchParams;
  const result = await resolveFirmaContext({
    asClientId: as ?? null,
    firmSlug: firm ?? null,
  });

  if (result.kind === "redirect") redirect(result.to);
  if (result.kind === "selector") redirect("/firma/selectie");
  if (result.kind === "no-access") return <NoAccessScreen user={result.user} />;

  const { user, client, viaAccountantPreview } = result;
  await recordFirmaAccessAudit({
    user,
    client,
    page: "patrimoniu",
    viaAccountantPreview,
  });

  const context = buildOwnerContextForFirma({
    clientId: client.id,
    clientName: client.name,
    slug: client.slug,
    activePage: "patrimoniu",
  });

  const published = await getLatestPublishedView(client.id);
  if (!published) {
    return (
      <OwnerLayout context={context}>
        <NothingPublishedScreen clientName={client.name} />
      </OwnerLayout>
    );
  }

  const meta = OWNER_PAGES.patrimoniu;

  return (
    <OwnerLayout context={context}>
      <PageHeader title={meta.title} subtitle={meta.subtitle} />
      <PatrimoniuView data={published.snapshot.patrimoniu} />
    </OwnerLayout>
  );
}
