import type { Metadata } from "next";
import Link from "next/link";
import { DOC_NAVIGATION } from "@/lib/docs-navigation";
import { pageTitle } from "@/lib/seo";

// Docs are currently behind auth. Flip this to true when docs go public.
const DOCS_PUBLIC = false;

export const metadata: Metadata = {
  title: pageTitle("Documentatie"),
  description:
    "Ghid complet Costify: import jurnal, balanta, CPP, KPI, arhitectura platformei si bazele contabilitatii romanesti.",
  alternates: { canonical: "/docs" },
  robots: DOCS_PUBLIC
    ? { index: true, follow: true }
    : { index: false, follow: false, nocache: true },
};

export default function DocsIndexPage() {
  return (
    <div>
      <div className="mb-12">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-light">
          Documentatie
        </div>
        <h1
          className="mt-3 text-[2.5rem] font-bold text-white"
          style={{ letterSpacing: "-0.045em", lineHeight: "1.05" }}
        >
          Ghid complet Costify
        </h1>
        <p
          className="mt-4 max-w-2xl text-[16px] leading-[1.7] text-gray-light"
          style={{ letterSpacing: "-0.01em" }}
        >
          Invata cum functioneaza platforma, cum sa folosesti fiecare modul si cum interpretezi rapoartele. Scris in limba romana pentru contabili si antreprenori.
        </p>
      </div>

      <div className="space-y-10">
        {DOC_NAVIGATION.map((category) => (
          <section key={category.id}>
            <div className="mb-4 flex items-baseline justify-between border-b border-dark-3 pb-3">
              <h2
                className="text-[20px] font-semibold text-white"
                style={{ letterSpacing: "-0.03em" }}
              >
                {category.label}
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-widest text-gray">
                {category.pages.length} articole
              </span>
            </div>
            <p className="mb-5 text-[14px] text-gray" style={{ letterSpacing: "-0.01em" }}>
              {category.description}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {category.pages.map((page) => (
                <Link
                  key={page.slug}
                  href={`/docs/${page.slug}`}
                  className="group rounded-lg border border-dark-3 bg-dark-2/50 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-dark-2"
                >
                  <div
                    className="text-[14px] font-semibold text-white"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {page.title}
                  </div>
                  {page.description && (
                    <div
                      className="mt-1 text-[12px] leading-[1.5] text-gray"
                      style={{ letterSpacing: "-0.01em" }}
                    >
                      {page.description}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
