import { NextResponse } from "next/server";
import { getSessionUser } from "@/modules/auth/session";
import { prisma } from "@/lib/db";

const MAX_CONTENT_LENGTH = 10_000;
const SLUG_PATTERN = /^[a-z0-9-]+$/;

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const url = new URL(request.url);
  const docSlug = url.searchParams.get("docSlug");

  if (!docSlug || !SLUG_PATTERN.test(docSlug)) {
    return NextResponse.json({ error: "docSlug obligatoriu si valid" }, { status: 400 });
  }

  const answers = await prisma.docAnswer.findMany({
    where: { docSlug },
    orderBy: { updatedAt: "desc" },
  });

  const authorIds = [...new Set(answers.map((a) => a.authorId))];
  const authors = await prisma.user.findMany({
    where: { id: { in: authorIds } },
    select: { id: true, name: true, email: true },
  });
  const authorById = new Map(authors.map((u) => [u.id, u]));

  return NextResponse.json({
    answers: answers.map((a) => ({
      id: a.id,
      sectionId: a.sectionId,
      sectionText: a.sectionText,
      content: a.content,
      updatedAt: a.updatedAt.toISOString(),
      author: authorById.get(a.authorId) ?? null,
    })),
  });
}

interface UpsertBody {
  docSlug?: unknown;
  sectionId?: unknown;
  sectionText?: unknown;
  content?: unknown;
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  let body: UpsertBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalid" }, { status: 400 });
  }

  const { docSlug, sectionId, sectionText, content } = body;

  if (typeof docSlug !== "string" || !SLUG_PATTERN.test(docSlug)) {
    return NextResponse.json({ error: "docSlug invalid" }, { status: 400 });
  }
  if (typeof sectionId !== "string" || !SLUG_PATTERN.test(sectionId)) {
    return NextResponse.json({ error: "sectionId invalid" }, { status: 400 });
  }
  if (typeof sectionText !== "string" || sectionText.length > 500) {
    return NextResponse.json({ error: "sectionText invalid" }, { status: 400 });
  }
  if (typeof content !== "string" || content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: "content invalid sau prea lung" }, { status: 400 });
  }

  const trimmed = content.trim();

  if (trimmed.length === 0) {
    await prisma.docAnswer.deleteMany({ where: { docSlug, sectionId } });
    return NextResponse.json({ deleted: true });
  }

  const answer = await prisma.docAnswer.upsert({
    where: { docSlug_sectionId: { docSlug, sectionId } },
    create: {
      docSlug,
      sectionId,
      sectionText,
      content: trimmed,
      authorId: user.id,
    },
    update: {
      content: trimmed,
      sectionText,
      authorId: user.id,
    },
  });

  return NextResponse.json({
    id: answer.id,
    updatedAt: answer.updatedAt.toISOString(),
    author: { id: user.id, name: user.name, email: user.email },
  });
}
