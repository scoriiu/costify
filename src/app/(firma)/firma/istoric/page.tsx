import { redirect } from "next/navigation";
import {
  OwnerLayout,
  buildOwnerContextForFirma,
  OWNER_PAGES,
} from "@/components/clients/owner";
import { listOwnerAuditTrail } from "@/modules/audit";
import { resolveFirmaContext } from "../_lib/resolve-client";
import { recordFirmaAccessAudit } from "../_lib/audit";
import { NoAccessScreen } from "../_lib/no-access";
import { OwnerHistoryList } from "@/components/clients/owner/owner-history-list";

interface Props {
  searchParams: Promise<{ as?: string; firm?: string }>;
}

export default async function FirmaIstoricPage(props: Props) {
  const { as, firm } = await props.searchParams;
  const result = await resolveFirmaContext({
    asClientId: as ?? null,
    firmSlug: firm ?? null,
  });

  if (result.kind === "redirect") redirect(result.to);
  if (result.kind === "selector") redirect("/firma/selectie");
  if (result.kind === "no-access") return <NoAccessScreen user={result.user} />;

  const { user, client, viaAccountantPreview } = result;
  await recordFirmaAccessAudit({ user, client, page: "istoric", viaAccountantPreview });

  const context = buildOwnerContextForFirma({
    clientId: client.id,
    clientName: client.name,
    slug: client.slug,
    activePage: "istoric",
  });

  const rows = await listOwnerAuditTrail(client.id, { limit: 100 });
  const meta = OWNER_PAGES["istoric"];

  return (
    <OwnerLayout context={context}>
      <div className="mb-6">
        <h1
          className="text-[28px] font-semibold text-white"
          style={{ letterSpacing: "-0.04em" }}
        >
          {meta.title}
        </h1>
        <p
          className="mt-2 text-[14px] text-gray-light max-w-2xl"
          style={{ letterSpacing: "-0.02em" }}
        >
          {meta.subtitle}
        </p>
      </div>
      <OwnerHistoryList rows={rows} />
    </OwnerLayout>
  );
}
