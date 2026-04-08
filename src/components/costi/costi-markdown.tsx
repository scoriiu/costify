"use client";

import { useMemo } from "react";

interface CostiMarkdownProps {
  content: string;
}

interface TableData {
  headers: string[];
  rows: string[][];
}

const EMOJI_RE = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;
function stripEmoji(text: string): string {
  return text.replace(EMOJI_RE, "").replace(/\s{2,}/g, " ").trim();
}

function parseTable(lines: string[]): TableData | null {
  if (lines.length < 2) return null;
  const parse = (line: string) =>
    line.split("|").map((c) => c.trim()).filter(Boolean);
  const headers = parse(lines[0]);
  if (!lines[1].match(/^[\s|:-]+$/)) return null;
  const rows = lines.slice(2).map(parse);
  return { headers, rows };
}

function InlineText({ text }: { text: string }) {
  const clean = stripEmoji(text);
  const parts = clean.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
        if (part.startsWith("`") && part.endsWith("`"))
          return <code key={i} className="rounded bg-dark px-1.5 py-0.5 text-xs font-mono text-primary-light">{part.slice(1, -1)}</code>;
        if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**"))
          return <em key={i} className="italic">{part.slice(1, -1)}</em>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function Table({ data }: { data: TableData }) {
  return (
    <div className="my-3 overflow-x-auto rounded-lg border border-dark-3">
      <table className="w-full text-[0.75rem]">
        <thead className="bg-dark-3/60">
          <tr>
            {data.headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold text-white whitespace-nowrap">
                <InlineText text={h} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-dark-3/50">
          {data.rows.map((row, i) => (
            <tr key={i} className="hover:bg-primary/[0.03] transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-gray-light">
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

function isList(line: string) {
  return /^[-*] /.test(line);
}

function isOrdered(line: string) {
  return /^\d+\. /.test(line);
}

function isContinuation(line: string) {
  return line.startsWith("  ") && !isList(line) && !isOrdered(line);
}

export function CostiMarkdown({ content }: CostiMarkdownProps) {
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
        if (table) {
          result.push(<Table key={key++} data={table} />);
        }
        continue;
      }

      // Headings
      const h1 = line.match(/^# (.+)/);
      if (h1) {
        result.push(<h1 key={key++} className="mb-3 text-base font-bold text-white"><InlineText text={h1[1]} /></h1>);
        i++; continue;
      }
      const h2 = line.match(/^## (.+)/);
      if (h2) {
        result.push(<h2 key={key++} className="mt-4 mb-2 text-sm font-bold text-white"><InlineText text={h2[1]} /></h2>);
        i++; continue;
      }
      const h3 = line.match(/^### (.+)/);
      if (h3) {
        result.push(<h3 key={key++} className="mt-3 mb-1.5 text-sm font-semibold text-primary-light"><InlineText text={h3[1]} /></h3>);
        i++; continue;
      }

      // HR
      if (line.match(/^---+$/)) {
        result.push(<hr key={key++} className="my-3 border-dark-3" />);
        i++; continue;
      }

      // Unordered list (collect items with continuation lines)
      if (isList(line)) {
        const items: string[] = [];
        while (i < lines.length && (isList(lines[i]) || isContinuation(lines[i]))) {
          if (isList(lines[i])) {
            items.push(lines[i].replace(/^[-*] /, ""));
          } else {
            items[items.length - 1] += " " + lines[i].trim();
          }
          i++;
        }
        result.push(
          <ul key={key++} className="mb-2 ml-4 space-y-1 text-[0.8rem] text-gray-light list-disc marker:text-primary/40">
            {items.map((item, j) => (
              <li key={j} className="leading-relaxed pl-1"><InlineText text={item} /></li>
            ))}
          </ul>
        );
        continue;
      }

      // Ordered list
      if (isOrdered(line)) {
        const items: string[] = [];
        while (i < lines.length && (isOrdered(lines[i]) || isContinuation(lines[i]))) {
          if (isOrdered(lines[i])) {
            items.push(lines[i].replace(/^\d+\. /, ""));
          } else {
            items[items.length - 1] += " " + lines[i].trim();
          }
          i++;
        }
        result.push(
          <ol key={key++} className="mb-2 ml-4 space-y-1 text-[0.8rem] text-gray-light list-decimal marker:text-primary/40">
            {items.map((item, j) => (
              <li key={j} className="leading-relaxed pl-1"><InlineText text={item} /></li>
            ))}
          </ol>
        );
        continue;
      }

      // Code block
      if (line.startsWith("```")) {
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }
        i++;
        result.push(
          <pre key={key++} className="my-2">
            <code className="block rounded-lg bg-dark p-3 text-xs font-mono text-gray-light overflow-x-auto">
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
          <blockquote key={key++} className="my-2 border-l-2 border-primary/40 pl-3 text-[0.8rem] text-gray italic">
            <InlineText text={quoteLines.join(" ")} />
          </blockquote>
        );
        continue;
      }

      // Empty line
      if (!line.trim()) {
        i++; continue;
      }

      // Paragraph
      result.push(
        <p key={key++} className="mb-2 text-[0.8rem] leading-relaxed text-gray-light">
          <InlineText text={line} />
        </p>
      );
      i++;
    }

    return result;
  }, [content]);

  return <div>{elements}</div>;
}
