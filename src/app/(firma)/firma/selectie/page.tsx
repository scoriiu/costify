import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveFirmaContext } from "../_lib/resolve-client";
import { destroySessionAction } from "../_lib/logout-action";

/**
 * OWNER-only selector page. Shown when the OWNER has access to more than one
 * client (multi-firm owner). Picking a firm sets the implicit "current firm"
 * by redirecting to /firma — the resolver still uses the single matching access
 * for now. Future iteration may store the picked firm in a cookie/session.
 *
 * NOTE: with the current resolver, an OWNER with N firms will keep landing
 * here every time they hit /firma. The "lock-in" via cookie is intentional
 * future work (see ADR-0004 PR-1.5).
 */
export default async function FirmaSelectorPage() {
  const result = await resolveFirmaContext();

  if (result.kind === "redirect") redirect(result.to);
  if (result.kind === "ok") redirect("/firma");
  if (result.kind === "no-access") redirect("/firma"); // page-level handles "no-access" UI

  // We're in the "selector" branch.
  const { user, clients } = result;

  return (
    <main className="min-h-screen bg-dark text-white px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <header className="mb-10">
          <h1
            className="text-[32px] font-semibold text-white"
            style={{ letterSpacing: "-0.04em" }}
          >
            Alege firma
          </h1>
          <p
            className="mt-2 text-[14px] text-gray-light"
            style={{ letterSpacing: "-0.02em" }}
          >
            Ai acces la {clients.length} firme. Alege firma pentru care vrei sa
            vezi datele.
          </p>
        </header>

        <ul className="space-y-3">
          {clients.map((c) => (
            <li key={c.clientId}>
              <Link
                href={`/firma?firm=${c.clientSlug}`}
                className="block rounded-xl border border-dark-3 bg-dark-2 p-5 transition-all hover:border-primary/40 hover:bg-dark-3/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p
                      className="text-[16px] font-semibold text-white truncate"
                      style={{ letterSpacing: "-0.04em" }}
                    >
                      {c.clientName}
                    </p>
                    {c.clientCui ? (
                      <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-gray">
                        CUI {c.clientCui}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className="font-mono text-[11px] uppercase tracking-wider text-primary-light"
                    aria-hidden
                  >
                    Deschide →
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <footer className="mt-12 flex items-center justify-between text-[12px] text-gray">
          <span style={{ letterSpacing: "-0.02em" }}>Conectat ca {user.email}</span>
          <form action={destroySessionAction}>
            <button
              type="submit"
              className="text-gray-light hover:text-primary-light transition-colors underline underline-offset-2"
              style={{ letterSpacing: "-0.02em" }}
            >
              Iesi din cont
            </button>
          </form>
        </footer>
      </div>
    </main>
  );
}
