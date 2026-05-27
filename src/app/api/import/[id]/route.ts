/**
 * Status endpoint for queue-based journal import.
 *
 * The ImportWizard polls this every ~500 ms while the worker chews on the
 * job. We return the live ImportEvent row fields straight through, plus
 * a few derived numbers the UI uses.
 *
 * Access: same tenant rules as POST /api/import — only users with access
 * to the owning client can see the status. The id-only URL is also a
 * mild safety net: ImportEvent ids are cuid()s, not enumerable.
 */
import { NextResponse } from "next/server";
import { getSessionUser } from "@/modules/auth/session";
import { verifyTenantAccess } from "@/modules/tenant";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const { id } = await ctx.params;
  const row = await prisma.importEvent.findUnique({
    where: { id },
    select: {
      id: true,
      clientId: true,
      fileName: true,
      status: true,
      progress: true,
      progressLabel: true,
      totalEntries: true,
      processedEntries: true,
      entriesAdded: true,
      errorMessage: true,
      createdAt: true,
    },
  });
  if (!row) return NextResponse.json({ error: "Importul nu a fost gasit" }, { status: 404 });

  const hasAccess = await verifyTenantAccess(user.id, row.clientId);
  if (!hasAccess) return NextResponse.json({ error: "Acces interzis" }, { status: 403 });

  return NextResponse.json(
    {
      id: row.id,
      status: row.status,
      progress: row.progress ?? 0,
      progressLabel: row.progressLabel ?? "",
      totalEntries: row.totalEntries,
      processedEntries: row.processedEntries,
      entriesAdded: row.entriesAdded,
      errorMessage: row.errorMessage,
      fileName: row.fileName,
      clientId: row.clientId,
      createdAt: row.createdAt.toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
