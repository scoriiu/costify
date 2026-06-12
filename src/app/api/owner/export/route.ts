import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/modules/auth/session";
import { verifyTenantAccess } from "@/modules/tenant/service";
import { hasClientAccess } from "@/modules/roles/client-access.service";
import { getPublishedView } from "@/modules/publishing";
import { recordAuditEvent } from "@/modules/audit/service";
import {
  buildOwnerExportWorkbook,
  ownerExportFileName,
} from "@/modules/reporting/owner/export";

/**
 * Downloads one published month as a multi-sheet XLSX, in entrepreneur
 * language. Same security boundary as /api/owner/published-snapshot: only
 * FROZEN published snapshots, accessible to the client's accountant or an
 * owner with ClientAccess. Every download is audit-logged.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));

  if (!clientId || !Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Parametri invalizi" }, { status: 400 });
  }

  const [isAccountant, isOwner] = await Promise.all([
    verifyTenantAccess(user.id, clientId),
    hasClientAccess(user.id, clientId),
  ]);
  if (!isAccountant && !isOwner) {
    return NextResponse.json({ error: "Acces interzis" }, { status: 403 });
  }

  const published = await getPublishedView(clientId, year, month);
  if (!published) {
    return NextResponse.json({ error: "Luna nu este publicata" }, { status: 404 });
  }

  const buffer = await buildOwnerExportWorkbook(published.snapshot, {
    publishedAt: published.publishedAt,
  });
  const fileName = ownerExportFileName(published.snapshot);

  try {
    await recordAuditEvent({
      tenantId: clientId,
      actorId: user.id,
      actorType: "user",
      pipelineStage: "export",
      action: "export",
      entityType: "owner_report",
      entityId: published.id,
      before: null,
      after: null,
      metadata: {
        year,
        month,
        fileName,
        actorEmail: user.email,
        actorRole: user.userRole,
        viaAccountant: isAccountant,
      },
    });
  } catch (err) {
    console.error("[owner-export] audit failed", err);
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
