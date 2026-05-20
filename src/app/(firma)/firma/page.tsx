import { redirect } from "next/navigation";
import {
  OwnerLayout,
  OwnerView,
  buildOwnerContextForFirma,
} from "@/components/clients/owner";
import { getLatestPublishedView } from "@/modules/publishing";
import { resolveFirmaContext } from "./_lib/resolve-client";
import { recordFirmaAccessAudit } from "./_lib/audit";
import { NoAccessScreen } from "./_lib/no-access";
import { NothingPublishedScreen } from "./_lib/nothing-published";
import { PublishedPeriodBanner } from "./_lib/published-banner";

interface Props {
  searchParams: Promise<{ as?: string; firm?: string }>;
}

export default async function FirmaHomePage(props: Props) {
  const { as, firm } = await props.searchParams;
  const result = await resolveFirmaContext({
    asClientId: as ?? null,
    firmSlug: firm ?? null,
  });

  if (result.kind === "redirect") redirect(result.to);
  if (result.kind === "selector") redirect("/firma/selectie");
  if (result.kind === "no-access") return <NoAccessScreen user={result.user} />;

  const { user, client, viaAccountantPreview } = result;
  await recordFirmaAccessAudit({ user, client, page: "home", viaAccountantPreview });

  const context = buildOwnerContextForFirma({
    clientId: client.id,
    clientName: client.name,
    slug: client.slug,
    activePage: "home",
  });

  const published = await getLatestPublishedView(client.id);

  if (!published) {
    return (
      <OwnerLayout context={context}>
        <NothingPublishedScreen clientName={client.name} />
      </OwnerLayout>
    );
  }

  const { snapshot } = published;

  return (
    <OwnerLayout context={context}>
      <PublishedPeriodBanner
        year={published.year}
        month={published.month}
        publishedAt={published.publishedAt}
        publisherName={published.publisherName}
        noteForOwner={published.noteForOwner}
        stale={published.stale && viaAccountantPreview}
      />
      <OwnerView snapshot={snapshot} context={context} marjaOperationala={null} />
    </OwnerLayout>
  );
}
