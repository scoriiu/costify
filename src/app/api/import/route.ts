import { NextResponse } from "next/server";
import { getSessionUser } from "@/modules/auth/session";
import { verifyTenantAccess } from "@/modules/tenant";
import { importJournal } from "@/modules/ingestion";

export const maxDuration = 120;

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const clientId = formData.get("clientId") as string | null;

  if (!file || !clientId) {
    return NextResponse.json({ error: "Fisierul si clientId sunt obligatorii" }, { status: 400 });
  }

  const hasAccess = await verifyTenantAccess(user.id, clientId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Client negasit" }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await importJournal({
    clientId,
    userId: user.id,
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
