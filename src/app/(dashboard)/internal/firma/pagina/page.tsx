import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSessionUser } from "@/modules/auth/session";
import { OwnerLayout, OwnerView, buildOwnerContextForFirma } from "@/components/clients/owner";
import { isInternalUser } from "@/lib/internal-access";
import { loadFirmaSnapshot } from "../_data/snapshot";
import { ShowcaseUnconfigured } from "../_components/showcase-unconfigured";

export default async function PaginaFirmaShowcase() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isInternalUser(user.email)) redirect("/clients");

  const data = await loadFirmaSnapshot();
  if (!data) return <ShowcaseUnconfigured />;
  const { snapshot, marjaOperationala } = data;

  // Build a non-preview context (this showcase imitates the real /firma view)
  const context = buildOwnerContextForFirma({
    clientId: snapshot.meta.clientId,
    clientName: snapshot.meta.name,
    slug: snapshot.meta.slug,
    activePage: "home",
  });

  return (
    <>
      {/* Showcase context bar — only in /internal/firma, not in production */}
      <div className="border-b border-dark-3 bg-primary/[0.06] px-4 py-2.5 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/internal/firma"
              className="inline-flex items-center gap-1.5 text-[12px] text-gray-light hover:text-white transition-colors"
            >
              <ArrowLeft size={12} /> Inapoi la specs
            </Link>
            <span
              className="font-mono text-[10px] uppercase tracking-wider text-primary"
              style={{ letterSpacing: "0.05em" }}
            >
              Specs vizuale · Vedere antreprenor
            </span>
          </div>
          <span
            className="font-mono text-[10px] text-gray"
            style={{ letterSpacing: "-0.02em" }}
          >
            Date reale {snapshot.meta.name} · {snapshot.meta.periodLabel}
          </span>
        </div>
      </div>

      <OwnerLayout context={context}>
        <OwnerView snapshot={snapshot} context={context} marjaOperationala={marjaOperationala} />
      </OwnerLayout>
    </>
  );
}
