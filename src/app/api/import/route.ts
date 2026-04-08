import { NextResponse } from "next/server";
import { getSessionUser } from "@/modules/auth/session";
import { verifyTenantAccess } from "@/modules/tenant";
import { importJournal } from "@/modules/ingestion";

export const maxDuration = 120;

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const clientId = formData.get("clientId") as string | null;
  const name = (formData.get("name") as string) || file?.name || "Import";

  if (!file || !clientId) {
    return NextResponse.json({ error: "File and clientId required" }, { status: 400 });
  }

  const hasAccess = await verifyTenantAccess(user.id, clientId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await importJournal({
    clientId,
    userId: user.id,
    name,
    fileName: file.name,
    buffer,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.message, details: result.error.context },
      { status: 422 }
    );
  }

  return NextResponse.json(result.data);
}
