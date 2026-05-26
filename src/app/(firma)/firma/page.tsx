import { redirect } from "next/navigation";
import {
  OwnerLayout,
  OwnerView,
  buildOwnerContextForFirma,
} from "@/components/clients/owner";
import {
  getLatestPublishedView,
  getPublishedView,
  listPublishedPeriods,
} from "@/modules/publishing";
import { resolveFirmaContext } from "./_lib/resolve-client";
import { recordFirmaAccessAudit } from "./_lib/audit";
import { NoAccessScreen } from "./_lib/no-access";
import { NothingPublishedScreen } from "./_lib/nothing-published";
import { PublishedPeriodBanner } from "./_lib/published-banner";

interface Props {
  searchParams: Promise<{
    as?: string;
    firm?: string;
    year?: string;
    month?: string;
    mode?: string;
  }>;
}

export default async function FirmaHomePage(props: Props) {
  const { as, firm, year, month, mode } = await props.searchParams;
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

  const publishedList = await listPublishedPeriods(client.id);
  const availablePeriods = publishedList.map((p) => ({ year: p.year, month: p.month }));

  const requestedYear = year ? parseInt(year, 10) : null;
  const requestedMonth = month ? parseInt(month, 10) : null;
  const published =
    requestedYear && requestedMonth
      ? await getPublishedView(client.id, requestedYear, requestedMonth)
      : await getLatestPublishedView(client.id);

  const ownerUser = { name: user.name, email: user.email };

  if (!published) {
    return (
      <OwnerLayout context={context} user={ownerUser}>
        <NothingPublishedScreen clientName={client.name} />
      </OwnerLayout>
    );
  }

  const { snapshot } = published;
  const viewMode = mode === "detailed" ? "detailed" : "simple";

  return (
    <OwnerLayout context={context} user={ownerUser}>
      <PublishedPeriodBanner
        year={published.year}
        month={published.month}
        publishedAt={published.publishedAt}
        publisherName={published.publisherName}
        noteForOwner={published.noteForOwner}
        stale={published.stale && viaAccountantPreview}
      />
      <OwnerView
        snapshot={snapshot}
        context={context}
        marjaOperationala={null}
        availablePeriods={availablePeriods}
        mode={viewMode}
      />
    </OwnerLayout>
  );
}
