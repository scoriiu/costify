import { redirect } from "next/navigation";
import { OwnerLayout, OwnerView, buildOwnerContextForFirma } from "@/components/clients/owner";
import { loadOwnerSnapshot } from "@/modules/reporting/owner";
import { getBalanceRows, getAvailablePeriods } from "@/modules/balances";
import { getCatalogMap } from "@/modules/accounts";
import { computeKpis } from "@/modules/reporting";
import { resolveFirmaContext } from "./_lib/resolve-client";
import { recordFirmaAccessAudit } from "./_lib/audit";
import { NoAccessScreen } from "./_lib/no-access";

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

  const periods = await getAvailablePeriods(client.id);
  const last = periods[periods.length - 1];
  if (!last) {
    return (
      <OwnerLayout context={context}>
        <div className="rounded-xl border border-dashed border-dark-3 bg-dark-2/50 p-8 sm:p-12">
          <p className="text-[14px] text-gray-light" style={{ letterSpacing: "-0.02em" }}>
            Inca nu ai date despre firma. Cand contabilul incarca primul jurnal, vei vedea aici cum sta firma.
          </p>
        </div>
      </OwnerLayout>
    );
  }

  const [snapshot, balanceResult, catalog] = await Promise.all([
    loadOwnerSnapshot({
      clientId: client.id,
      clientName: client.name,
      clientCui: client.cui,
      clientSlug: client.slug,
      year: last.year,
      month: last.month,
    }),
    getBalanceRows(client.id, last.year, last.month),
    getCatalogMap(),
  ]);

  const marja = balanceResult.ok ? computeKpis(balanceResult.data, catalog).marjaOperationala : null;

  return (
    <OwnerLayout context={context}>
      <OwnerView snapshot={snapshot} context={context} marjaOperationala={marja} />
    </OwnerLayout>
  );
}
