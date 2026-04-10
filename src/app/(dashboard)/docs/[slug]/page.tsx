import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ArrowLeft, ArrowRight } from "lucide-react";
import { getDoc, extractHeadings } from "@/lib/docs";
import { DocMarkdown } from "@/components/docs/doc-markdown";
import { DocsToc } from "@/components/docs/docs-toc";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function DocPage({ params }: Props) {
  const { slug } = await params;
  const doc = await getDoc(slug);
  if (!doc) notFound();

  const headings = extractHeadings(doc.content);

  return (
    <div className="flex gap-12">
      <div className="min-w-0 flex-1">
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-gray">
          <Link href="/docs" className="transition-colors hover:text-white">
            Docs
          </Link>
          <ChevronRight size={12} className="opacity-50" />
          <span className="text-gray-light">{doc.category.label}</span>
          <ChevronRight size={12} className="opacity-50" />
          <span className="text-white">{doc.title}</span>
        </nav>

        {/* Content */}
        {doc.exists ? (
          <article>
            <DocMarkdown content={doc.content} />
          </article>
        ) : (
          <StubArticle title={doc.title} description={doc.description} slug={doc.slug} />
        )}

        {/* Prev/Next navigation */}
        {(doc.prev || doc.next) && (
          <nav className="mt-20 grid gap-4 border-t border-dark-3 pt-8 sm:grid-cols-2">
            {doc.prev ? (
              <Link
                href={`/docs/${doc.prev.slug}`}
                className="group rounded-xl border border-dark-3 bg-dark-2/50 p-5 transition-all hover:border-primary/30 hover:bg-dark-2"
              >
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-gray">
                  <ArrowLeft size={12} />
                  Anterior
                </div>
                <div
                  className="mt-2 text-[15px] font-semibold text-white group-hover:text-primary-light"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {doc.prev.title}
                </div>
              </Link>
            ) : (
              <div />
            )}
            {doc.next ? (
              <Link
                href={`/docs/${doc.next.slug}`}
                className="group rounded-xl border border-dark-3 bg-dark-2/50 p-5 text-right transition-all hover:border-primary/30 hover:bg-dark-2"
              >
                <div className="flex items-center justify-end gap-2 font-mono text-[10px] uppercase tracking-widest text-gray">
                  Urmator
                  <ArrowRight size={12} />
                </div>
                <div
                  className="mt-2 text-[15px] font-semibold text-white group-hover:text-primary-light"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {doc.next.title}
                </div>
              </Link>
            ) : (
              <div />
            )}
          </nav>
        )}
      </div>

      {/* Right TOC */}
      {doc.exists && headings.length > 0 && (
        <aside className="hidden w-56 shrink-0 xl:block">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
            <DocsToc headings={headings} />
          </div>
        </aside>
      )}
    </div>
  );
}

function StubArticle({ title, description, slug }: { title: string; description?: string; slug: string }) {
  return (
    <div>
      <h1
        className="text-[2.25rem] font-bold text-white"
        style={{ letterSpacing: "-0.045em", lineHeight: "1.1" }}
      >
        {title}
      </h1>
      {description && (
        <p
          className="mt-4 text-[17px] leading-[1.65] text-gray-light"
          style={{ letterSpacing: "-0.01em" }}
        >
          {description}
        </p>
      )}
      <div className="mt-12 rounded-xl border border-dark-3 bg-dark-2 p-8">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-widest text-warn">
          In lucru
        </div>
        <p className="mt-3 text-[14px] leading-[1.7] text-gray-light">
          Acest articol nu a fost inca scris. Va aparea in curand in{" "}
          <code className="rounded bg-dark-3 px-1.5 py-0.5 font-mono text-[12px] text-primary-light">
            docs/ro/{slug}.md
          </code>
          .
        </p>
        <p className="mt-3 text-[13px] text-gray">
          Intre timp, poti explora celelalte articole din meniul din stanga.
        </p>
      </div>
    </div>
  );
}
