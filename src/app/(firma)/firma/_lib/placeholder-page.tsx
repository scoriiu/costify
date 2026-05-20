import { redirect } from "next/navigation";
import {
  OwnerLayout,
  EmptyPagePlaceholder,
  buildOwnerContextForFirma,
  OWNER_PAGES,
  type OwnerPageKey,
} from "@/components/clients/owner";
import { resolveFirmaContext } from "./resolve-client";
import { recordFirmaAccessAudit } from "./audit";
import { NoAccessScreen } from "./no-access";

/**
 * Renders a placeholder page for an owner sub-page that hasn't been built yet.
 * Uses the OWNER_PAGES metadata for title/subtitle/preview bullets.
 *
 * Each /firma/[page]/page.tsx is a thin wrapper that calls this helper. When we
 * build the real page, we replace that file with proper rendering.
 */
interface PlaceholderOptions {
  asClientId?: string | null;
  firmSlug?: string | null;
}

export async function renderFirmaPlaceholder(
  pageKey: OwnerPageKey,
  opts: PlaceholderOptions = {}
) {
  const result = await resolveFirmaContext({
    asClientId: opts.asClientId ?? null,
    firmSlug: opts.firmSlug ?? null,
  });

  if (result.kind === "redirect") redirect(result.to);
  if (result.kind === "selector") redirect("/firma/selectie");
  if (result.kind === "no-access") return <NoAccessScreen user={result.user} />;

  const { user, client, viaAccountantPreview } = result;
  await recordFirmaAccessAudit({ user, client, page: pageKey, viaAccountantPreview });

  const meta = OWNER_PAGES[pageKey];
  const context = buildOwnerContextForFirma({
    clientId: client.id,
    clientName: client.name,
    slug: client.slug,
    activePage: pageKey,
  });

  return (
    <OwnerLayout context={context}>
      <EmptyPagePlaceholder title={meta.title} subtitle={meta.subtitle} preview={meta.preview} />
    </OwnerLayout>
  );
}
