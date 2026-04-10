import fs from "fs/promises";
import path from "path";
import { DOC_NAVIGATION, slugify, type DocPage, type DocCategory, type DocHeading } from "./docs-navigation";

export { DOC_NAVIGATION, slugify };
export type { DocPage, DocCategory, DocHeading };

const DOCS_DIR = path.join(process.cwd(), "docs", "ro");

function buildSlugMap(): Map<string, { page: DocPage; category: DocCategory }> {
  const map = new Map();
  for (const category of DOC_NAVIGATION) {
    for (const page of category.pages) {
      map.set(page.slug, { page, category });
    }
  }
  return map;
}

export interface DocWithContent {
  slug: string;
  title: string;
  description?: string;
  category: { id: string; label: string };
  content: string;
  exists: boolean;
  prev: DocPage | null;
  next: DocPage | null;
}

export async function getDoc(slug: string): Promise<DocWithContent | null> {
  if (!isValidSlug(slug)) return null;
  const slugMap = buildSlugMap();
  const entry = slugMap.get(slug);
  if (!entry) return null;

  const { page, category } = entry;
  const content = await readMarkdownFile(slug);
  const { prev, next } = computeNeighbors(slug);

  return {
    slug,
    title: page.title,
    description: page.description,
    category: { id: category.id, label: category.label },
    content: content ?? "",
    exists: content !== null,
    prev,
    next,
  };
}

async function readMarkdownFile(slug: string): Promise<string | null> {
  const filePath = path.join(DOCS_DIR, `${slug}.md`);
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      console.warn(`[docs] failed to read ${filePath}: ${code}`);
    }
    return null;
  }
}

function computeNeighbors(slug: string): { prev: DocPage | null; next: DocPage | null } {
  const flat: DocPage[] = [];
  for (const category of DOC_NAVIGATION) {
    for (const page of category.pages) {
      flat.push(page);
    }
  }
  const index = flat.findIndex((p) => p.slug === slug);
  if (index === -1) return { prev: null, next: null };
  return {
    prev: index > 0 ? flat[index - 1] : null,
    next: index < flat.length - 1 ? flat[index + 1] : null,
  };
}

export function extractHeadings(content: string): DocHeading[] {
  const lines = content.split("\n");
  const headings: DocHeading[] = [];
  let inCodeBlock = false;
  for (const line of lines) {
    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;
    const h2 = line.match(/^## (.+)/);
    if (h2) {
      headings.push({ level: 2, text: h2[1].trim(), id: slugify(h2[1]) });
      continue;
    }
    const h3 = line.match(/^### (.+)/);
    if (h3) {
      headings.push({ level: 3, text: h3[1].trim(), id: slugify(h3[1]) });
    }
  }
  return headings;
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug);
}
