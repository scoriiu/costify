"use client";

import { useMemo } from "react";

interface Props {
  content: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface TableData {
  headers: string[];
  rows: string[][];
}

function parseTable(lines: string[]): TableData | null {
  if (lines.length < 2) return null;
  const parse = (line: string) => line.split("|").map((c) => c.trim()).filter((_, i, arr) => !(i === 0 && arr[0] === "") && !(i === arr.length - 1 && arr[arr.length - 1] === ""));
  const headers = parse(lines[0]);
  if (!lines[1].match(/^[\s|:-]+$/)) return null;
  const rows = lines.slice(2).map(parse);
  return { headers, rows };
}

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
        if (part.startsWith("`") && part.endsWith("`"))
          return <code key={i} className="rounded bg-dark-3 px-1.5 py-0.5 font-mono text-[0.85em] text-primary-light">{part.slice(1, -1)}</code>;
        if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**"))
          return <em key={i} className="italic">{part.slice(1, -1)}</em>;
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
          const [, label, href] = linkMatch;
          const resolvedHref = href.startsWith("./") && href.endsWith(".md")
            ? `/docs/${href.slice(2, -3)}`
            : href;
          return (
            <a
              key={i}
              href={resolvedHref}
              className="text-primary-light underline decoration-primary/30 underline-offset-2 transition-colors hover:text-white hover:decoration-primary"
            >
              {label}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function Table({ data }: { data: TableData }) {
  return (
    <div className="my-6 overflow-x-auto rounded-xl border border-dark-3">
      <table className="w-full text-[14px]">
        <thead className="border-b border-dark-3 bg-dark-2">
          <tr>
            {data.headers.map((h, i) => (
              <th
                key={i}
                className="px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-widest text-gray-light whitespace-nowrap"
              >
                <InlineText text={h} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-dark-3">
          {data.rows.map((row, i) => (
            <tr key={i} className="transition-colors hover:bg-dark-2/40">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-gray-light">
                  <InlineText text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function isList(line: string) { return /^[-*] /.test(line); }
function isOrdered(line: string) { return /^\d+\. /.test(line); }
function isContinuation(line: string) { return line.startsWith("  ") && !isList(line) && !isOrdered(line); }

export function DocMarkdown({ content }: Props) {
  const elements = useMemo(() => {
    const lines = content.split("\n");
    const result: React.ReactNode[] = [];
    let i = 0;
    let key = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Table
      if (line.includes("|") && i + 1 < lines.length && lines[i + 1]?.match(/^[\s|:-]+$/)) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].includes("|")) {
          tableLines.push(lines[i]);
          i++;
        }
        const table = parseTable(tableLines);
        if (table) result.push(<Table key={key++} data={table} />);
        continue;
      }

      // Headings
      const h1 = line.match(/^# (.+)/);
      if (h1) {
        const id = slugify(h1[1]);
        result.push(
          <h1
            key={key++}
            id={id}
            className="mb-4 mt-2 text-[2.25rem] font-bold text-white"
            style={{ letterSpacing: "-0.045em", lineHeight: "1.1" }}
          >
            <InlineText text={h1[1]} />
          </h1>
        );
        i++; continue;
      }
      const h2 = line.match(/^## (.+)/);
      if (h2) {
        const id = slugify(h2[1]);
        result.push(
          <h2
            key={key++}
            id={id}
            className="mb-3 mt-12 text-[1.5rem] font-bold text-white"
            style={{ letterSpacing: "-0.04em", lineHeight: "1.2" }}
          >
            <InlineText text={h2[1]} />
          </h2>
        );
        i++; continue;
      }
      const h3 = line.match(/^### (.+)/);
      if (h3) {
        const id = slugify(h3[1]);
        result.push(
          <h3
            key={key++}
            id={id}
            className="mb-2 mt-8 text-[1.125rem] font-semibold text-white"
            style={{ letterSpacing: "-0.03em", lineHeight: "1.3" }}
          >
            <InlineText text={h3[1]} />
          </h3>
        );
        i++; continue;
      }
      const h4 = line.match(/^#### (.+)/);
      if (h4) {
        result.push(
          <h4
            key={key++}
            className="mb-2 mt-6 text-[1rem] font-semibold text-primary-light"
            style={{ letterSpacing: "-0.02em" }}
          >
            <InlineText text={h4[1]} />
          </h4>
        );
        i++; continue;
      }

      // HR
      if (line.match(/^---+$/)) {
        result.push(<hr key={key++} className="my-10 border-dark-3" />);
        i++; continue;
      }

      // Unordered list
      if (isList(line)) {
        const items: string[] = [];
        while (i < lines.length && (isList(lines[i]) || isContinuation(lines[i]))) {
          if (isList(lines[i])) items.push(lines[i].replace(/^[-*] /, ""));
          else items[items.length - 1] += " " + lines[i].trim();
          i++;
        }
        result.push(
          <ul
            key={key++}
            className="mb-4 ml-5 space-y-2 text-[15px] leading-[1.7] text-gray-light list-disc marker:text-primary/50"
          >
            {items.map((item, j) => (
              <li key={j} className="pl-1.5"><InlineText text={item} /></li>
            ))}
          </ul>
        );
        continue;
      }

      // Ordered list
      if (isOrdered(line)) {
        const items: string[] = [];
        while (i < lines.length && (isOrdered(lines[i]) || isContinuation(lines[i]))) {
          if (isOrdered(lines[i])) items.push(lines[i].replace(/^\d+\. /, ""));
          else items[items.length - 1] += " " + lines[i].trim();
          i++;
        }
        result.push(
          <ol
            key={key++}
            className="mb-4 ml-5 space-y-2 text-[15px] leading-[1.7] text-gray-light list-decimal marker:text-primary/50 marker:font-mono marker:text-[13px]"
          >
            {items.map((item, j) => (
              <li key={j} className="pl-1.5"><InlineText text={item} /></li>
            ))}
          </ol>
        );
        continue;
      }

      // Code block (fenced)
      if (line.startsWith("```")) {
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }
        i++;
        result.push(
          <pre
            key={key++}
            className="my-5 overflow-x-auto rounded-xl border border-dark-3 bg-dark-2 p-4"
          >
            <code className="block font-mono text-[12.5px] leading-[1.6] text-gray-light">
              {codeLines.join("\n")}
            </code>
          </pre>
        );
        continue;
      }

      // Blockquote
      if (line.startsWith("> ")) {
        const quoteLines: string[] = [];
        while (i < lines.length && lines[i].startsWith("> ")) {
          quoteLines.push(lines[i].slice(2));
          i++;
        }
        result.push(
          <blockquote
            key={key++}
            className="my-5 border-l-2 border-primary/50 bg-primary/[0.03] py-3 pl-5 pr-4 text-[15px] italic leading-[1.7] text-gray-light"
          >
            <InlineText text={quoteLines.join(" ")} />
          </blockquote>
        );
        continue;
      }

      // Empty line
      if (!line.trim()) { i++; continue; }

      // Paragraph (collect consecutive non-empty, non-special lines)
      const paraLines: string[] = [line];
      i++;
      while (
        i < lines.length &&
        lines[i].trim() &&
        !lines[i].match(/^#{1,6} /) &&
        !lines[i].match(/^---+$/) &&
        !isList(lines[i]) &&
        !isOrdered(lines[i]) &&
        !lines[i].startsWith("```") &&
        !lines[i].startsWith("> ") &&
        !(lines[i].includes("|") && lines[i + 1]?.match(/^[\s|:-]+$/))
      ) {
        paraLines.push(lines[i]);
        i++;
      }
      result.push(
        <p
          key={key++}
          className="mb-4 text-[15px] leading-[1.75] text-gray-light"
          style={{ letterSpacing: "-0.01em" }}
        >
          <InlineText text={paraLines.join(" ")} />
        </p>
      );
    }

    return result;
  }, [content]);

  return <div className="max-w-none">{elements}</div>;
}
