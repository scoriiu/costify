import { prisma } from "@/lib/db";
import { getBalanceRows } from "@/modules/balances";
import { computeKpis, computeCpp } from "@/modules/reporting";

const MAX_JOURNAL_RESULTS = 50;
const DEFAULT_JOURNAL_RESULTS = 20;

async function resolveClient(userId: string, clientName: string) {
  const client = await prisma.client.findFirst({
    where: {
      userId,
      active: true,
      name: { contains: clientName, mode: "insensitive" },
    },
    select: { id: true, name: true, slug: true },
  });

  if (!client) return { error: `Clientul "${clientName}" nu a fost gasit.` };
  return { client };
}

export async function handleToolCall(
  userId: string,
  toolName: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (toolName) {
    case "list_clients":
      return handleListClients(userId);
    case "get_client_kpis":
      return handleGetKpis(userId, input);
    case "get_balance":
      return handleGetBalance(userId, input);
    case "get_cpp":
      return handleGetCpp(userId, input);
    case "get_journal_entries":
      return handleGetJournalEntries(userId, input);
    case "get_available_periods":
      return handleGetPeriods(userId, input);
    default:
      return JSON.stringify({ error: `Tool necunoscut: ${toolName}` });
  }
}

async function handleListClients(userId: string): Promise<string> {
  const clients = await prisma.client.findMany({
    where: { userId, active: true },
    orderBy: { name: "asc" },
    include: { _count: { select: { journalLines: { where: { deletedAt: null } } } } },
  });

  const result = clients.map((c) => ({
    name: c.name,
    cui: c.cui,
    caen: c.caen,
    entries: c._count.journalLines,
  }));

  return JSON.stringify(result);
}

async function handleGetKpis(userId: string, input: Record<string, unknown>): Promise<string> {
  const resolved = await resolveClient(userId, input.client_name as string);
  if ("error" in resolved) return JSON.stringify(resolved);

  const result = await getBalanceRows(resolved.client.id, input.year as number, input.month as number);
  if (!result.ok) return JSON.stringify({ error: "Nu exista date pentru aceasta perioada." });

  const kpis = computeKpis(result.data);
  return JSON.stringify({ client: resolved.client.name, year: input.year, month: input.month, ...kpis });
}

async function handleGetBalance(userId: string, input: Record<string, unknown>): Promise<string> {
  const resolved = await resolveClient(userId, input.client_name as string);
  if ("error" in resolved) return JSON.stringify(resolved);

  const result = await getBalanceRows(resolved.client.id, input.year as number, input.month as number);
  if (!result.ok) return JSON.stringify({ error: "Nu exista date pentru aceasta perioada." });

  let rows = result.data.filter((r) => r.isLeaf);
  const prefix = input.account_prefix as string | undefined;
  if (prefix) {
    rows = rows.filter((r) => r.contBase.startsWith(prefix) || r.cont.startsWith(prefix));
  }

  const summary = rows.map((r) => ({
    cont: r.cont,
    denumire: r.denumire,
    soldInD: r.soldInD,
    soldInC: r.soldInC,
    rulajD: r.rulajD,
    rulajC: r.rulajC,
    finD: r.finD,
    finC: r.finC,
  }));

  return JSON.stringify({
    client: resolved.client.name,
    year: input.year,
    month: input.month,
    accounts: summary.length,
    rows: summary,
  });
}

async function handleGetCpp(userId: string, input: Record<string, unknown>): Promise<string> {
  const resolved = await resolveClient(userId, input.client_name as string);
  if ("error" in resolved) return JSON.stringify(resolved);

  const result = await getBalanceRows(resolved.client.id, input.year as number, input.month as number);
  if (!result.ok) return JSON.stringify({ error: "Nu exista date pentru aceasta perioada." });

  const cpp = computeCpp(result.data);
  return JSON.stringify({
    client: resolved.client.name,
    year: input.year,
    month: input.month,
    venituriExploatare: cpp.venituriExploatare,
    cheltuieliExploatare: cpp.cheltuieliExploatare,
    rezultatExploatare: cpp.rezultatExploatare,
    venituriFinanciare: cpp.venituriFinanciare,
    cheltuieliFinanciare: cpp.cheltuieliFinanciare,
    rezultatFinanciar: cpp.rezultatFinanciar,
    rezultatBrut: cpp.rezultatBrut,
    rezultatNet: cpp.rezultatNet,
    lines: cpp.lines.filter((l) => !l.isHeader && l.value !== 0),
  });
}

async function handleGetJournalEntries(userId: string, input: Record<string, unknown>): Promise<string> {
  const resolved = await resolveClient(userId, input.client_name as string);
  if ("error" in resolved) return JSON.stringify(resolved);

  const limit = Math.min(
    (input.limit as number) || DEFAULT_JOURNAL_RESULTS,
    MAX_JOURNAL_RESULTS
  );

  const where: Record<string, unknown> = {
    clientId: resolved.client.id,
    deletedAt: null,
  };

  if (input.year) where.year = input.year;
  if (input.month) where.month = input.month;

  const account = input.account as string | undefined;
  if (account) {
    where.OR = [
      { contD: { contains: account } },
      { contC: { contains: account } },
    ];
  }

  const search = input.search as string | undefined;
  if (search) {
    where.explicatie = { contains: search, mode: "insensitive" };
  }

  const entries = await prisma.journalLine.findMany({
    where,
    orderBy: [{ data: "desc" }, { ndp: "desc" }],
    take: limit,
    select: {
      data: true,
      ndp: true,
      contD: true,
      contC: true,
      suma: true,
      explicatie: true,
      felD: true,
    },
  });

  const total = await prisma.journalLine.count({ where });

  return JSON.stringify({
    client: resolved.client.name,
    total,
    showing: entries.length,
    entries: entries.map((e) => ({
      data: e.data.toISOString().split("T")[0],
      ndp: e.ndp,
      contD: e.contD,
      contC: e.contC,
      suma: Number(e.suma),
      explicatie: e.explicatie,
      felD: e.felD,
    })),
  });
}

async function handleGetPeriods(userId: string, input: Record<string, unknown>): Promise<string> {
  const resolved = await resolveClient(userId, input.client_name as string);
  if ("error" in resolved) return JSON.stringify(resolved);

  const periods = await prisma.journalLine.findMany({
    where: { clientId: resolved.client.id, deletedAt: null },
    select: { year: true, month: true },
    distinct: ["year", "month"],
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  return JSON.stringify({
    client: resolved.client.name,
    periods: periods.map((p) => ({ year: p.year, month: p.month })),
  });
}
