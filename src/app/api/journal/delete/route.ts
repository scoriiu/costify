import { NextResponse } from "next/server";
import { getSessionUser } from "@/modules/auth/session";
import { verifyTenantAccess } from "@/modules/tenant";
import { softDeleteEntriesFrom } from "@/modules/ingestion";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Neautorizat" }, { status: 401 });

  const body = await request.json();
  const { clientId, fromDate, confirmation } = body;

  if (!clientId || !fromDate || !confirmation) {
    return NextResponse.json({ error: "Toate campurile sunt obligatorii" }, { status: 400 });
  }

  if (confirmation !== "STERGE") {
    return NextResponse.json({ error: "Confirmare incorecta" }, { status: 400 });
  }

  const hasAccess = await verifyTenantAccess(user.id, clientId);
  if (!hasAccess) return NextResponse.json({ error: "Acces interzis" }, { status: 403 });

  const date = new Date(fromDate);
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: "Data invalida" }, { status: 400 });
  }

  const result = await softDeleteEntriesFrom(clientId, user.id, date);

  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 422 });
  }

  return NextResponse.json(result.data);
}
