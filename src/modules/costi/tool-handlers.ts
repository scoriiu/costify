import { prisma } from "@/lib/db";
import { getBalanceRows, getActiveEntries } from "@/modules/balances";
import { computeKpis, computeCpp, computeCppF20 } from "@/modules/reporting";
import { getCatalogMap } from "@/modules/accounts";
import {
  getRegimeForPeriod,
  taxRegimeLabel,
  taxRegimeAccount,
} from "@/modules/clients/tax-regime";
import { detectTaxRegimeTimeline } from "@/modules/clients/tax-regime-detector";
import { computeIndustryKpis, resolveIndustry } from "@/modules/reporting/industry";

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
    case "get_unmapped_accounts":
      return handleGetUnmappedAccounts(userId, input);
    case "get_tax_regime_timeline":
      return handleGetTaxRegimeTimeline(userId, input);
    case "get_industry_kpis":
      return handleGetIndustryKpis(userId, input);
    case "get_account_catalog":
      return handleGetAccountCatalog(input);
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

async function handleGetIndustryKpis(
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const resolved = await resolveClient(userId, input.client_name as string);
  if ("error" in resolved) return JSON.stringify(resolved);

  const year = input.year as number;
  const month = input.month as number;

  const [result, prevResult, catalog, fields] = await Promise.all([
    getBalanceRows(resolved.client.id, year, month),
    getBalanceRows(resolved.client.id, year - 1, month),
    getCatalogMap(),
    prisma.client.findUnique({
      where: { id: resolved.client.id },
      select: { industry: true, industrySource: true, caen: true },
    }),
  ]);
  if (!result.ok) return JSON.stringify({ error: "Nu exista date pentru aceasta perioada." });

  const industry = resolveIndustry({
    industry: fields?.industry ?? null,
    industrySource: fields?.industrySource ?? null,
    caen: fields?.caen ?? null,
  });
  const section = computeIndustryKpis(result.data, catalog, {
    industry: industry.id,
    industrySource: industry.source,
    caen: fields?.caen ?? null,
    year,
    month,
    prevYearRows: prevResult.ok ? prevResult.data : [],
  });

  const kpiId = input.kpi_id as string | undefined;
  if (kpiId) {
    const kpi = section.groups.flatMap((g) => g.kpis).find((k) => k.id === kpiId);
    if (!kpi) {
      return JSON.stringify({
        error: `KPI "${kpiId}" inexistent.`,
        availableIds: section.groups.flatMap((g) => g.kpis.map((k) => k.id)),
      });
    }
    return JSON.stringify({
      client: resolved.client.name,
      industry: section.industryLabel,
      year,
      month,
      kpi,
    });
  }

  // Compact form: full trace only via kpi_id to keep the payload small.
  return JSON.stringify({
    client: resolved.client.name,
    industry: section.industryLabel,
    industrySource: section.industrySource,
    caen: section.caen,
    year,
    month,
    journalHint: section.journalHint,
    note: "Valori cumulate ianuarie -> luna selectata. Pentru formula completa si valorile de intrare ale unui KPI, apeleaza din nou cu kpi_id.",
    groups: section.groups.map((g) => ({
      id: g.id,
      label: g.label,
      kpis: g.kpis.map((k) => ({
        id: k.id,
        label: k.labelContabil,
        value: k.value,
        format: k.format,
        target: k.thresholds?.label ?? null,
        state: k.state,
        unavailable: k.unavailableReason !== null ? true : undefined,
      })),
    })),
  });
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
    unmapped: r.unmapped,
    soldInD: r.soldInD,
    soldInC: r.soldInC,
    rulajD: r.rulajD,
    rulajC: r.rulajC,
    finD: r.finD,
    finC: r.finC,
  }));

  const unmappedCount = summary.filter((r) => r.unmapped).length;

  return JSON.stringify({
    client: resolved.client.name,
    year: input.year,
    month: input.month,
    accounts: summary.length,
    unmappedCount,
    rows: summary,
  });
}

async function handleGetCpp(userId: string, input: Record<string, unknown>): Promise<string> {
  const resolved = await resolveClient(userId, input.client_name as string);
  if ("error" in resolved) return JSON.stringify(resolved);

  const [result, catalog, taxRegime] = await Promise.all([
    getBalanceRows(resolved.client.id, input.year as number, input.month as number),
    getCatalogMap(),
    getRegimeForPeriod(resolved.client.id, input.year as number, input.month as number),
  ]);
  if (!result.ok) return JSON.stringify({ error: "Nu exista date pentru aceasta perioada." });

  const mode = (input.mode as string | undefined) === "f20" ? "f20" : "simplified";

  if (mode === "f20") {
    const cpp = computeCppF20(result.data, catalog, { taxRegime });
    return JSON.stringify({
      client: resolved.client.name,
      year: input.year,
      month: input.month,
      mode: "f20",
      taxRegime,
      version: cpp.version,
      venituriExploatare: cpp.venituriExploatare,
      cheltuieliExploatare: cpp.cheltuieliExploatare,
      rezultatExploatare: cpp.rezultatExploatare,
      venituriFinanciare: cpp.venituriFinanciare,
      cheltuieliFinanciare: cpp.cheltuieliFinanciare,
      rezultatFinanciar: cpp.rezultatFinanciar,
      venituriTotale: cpp.venituriTotale,
      cheltuieliTotale: cpp.cheltuieliTotale,
      rezultatBrut: cpp.rezultatBrut,
      rezultatNet: cpp.rezultatNet,
      // Only non-zero rows — keeps Costi's context tight.
      rows: cpp.lines.filter((l) => l.value !== 0),
    });
  }

  const cpp = computeCpp(result.data, catalog, { taxRegime });
  return JSON.stringify({
    client: resolved.client.name,
    year: input.year,
    month: input.month,
    mode: "simplified",
    taxRegime,
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

async function handleGetUnmappedAccounts(
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const resolved = await resolveClient(userId, input.client_name as string);
  if ("error" in resolved) return JSON.stringify(resolved);

  const result = await getBalanceRows(
    resolved.client.id,
    input.year as number,
    input.month as number
  );
  if (!result.ok) return JSON.stringify({ error: "Nu exista date pentru aceasta perioada." });

  const unmapped = result.data
    .filter((r) => r.isLeaf && r.unmapped)
    .map((r) => ({
      cont: r.cont,
      contBase: r.contBase,
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
    total: unmapped.length,
    explanation:
      "Aceste conturi nu au cod exact in catalogul OMFP 1802. " +
      "Denumirea afisata vine din import (Saga) sau din contul parinte prin fallback prefix. " +
      "Contabilul trebuie sa verifice daca sunt conturi analitice legitime sau coduri lipsa din catalog.",
    rows: unmapped,
  });
}

async function handleGetTaxRegimeTimeline(
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const resolved = await resolveClient(userId, input.client_name as string);
  if ("error" in resolved) return JSON.stringify(resolved);

  const entries = await getActiveEntries(resolved.client.id);
  const timeline = detectTaxRegimeTimeline(entries);

  if (timeline.length === 0) {
    return JSON.stringify({
      client: resolved.client.name,
      transitions: [],
      note: "Nu exista intrari in jurnal pentru acest client. Regimul nu poate fi detectat fara date.",
    });
  }

  const current = timeline[timeline.length - 1];
  const serializedTimeline = timeline.map((t) => ({
    startDate: t.startDate.toISOString().slice(0, 10),
    taxRegime: t.taxRegime,
    label: taxRegimeLabel(t.taxRegime),
    cont: taxRegimeAccount(t.taxRegime),
    confidence: t.confidence,
    reason: t.reason,
    warnings: t.warnings,
  }));

  return JSON.stringify({
    client: resolved.client.name,
    current: {
      taxRegime: current.taxRegime,
      label: taxRegimeLabel(current.taxRegime),
      cont: taxRegimeAccount(current.taxRegime),
      since: current.startDate.toISOString().slice(0, 10),
    },
    transitions: serializedTimeline,
    note:
      "Timeline detectat din registru jurnal pe baza conturilor 69x (impozit). Pentru perioade fara impozit acumulat, regimul ramane cel din ultima tranzitie. Avertismentele indica ani cu semnale mixte (rebooking la inchidere) sau cifra de afaceri peste plafon micro.",
  });
}

async function handleGetAccountCatalog(input: Record<string, unknown>): Promise<string> {
  const catalog = await getCatalogMap();
  const code = input.code as string | undefined;
  const prefix = input.prefix as string | undefined;
  const cppGroup = input.cpp_group as string | undefined;

  let entries = Array.from(catalog.values());

  if (code) {
    const exact = catalog.get(code);
    return JSON.stringify({
      query: { code },
      found: !!exact,
      result: exact
        ? {
            code: exact.code,
            name: exact.name,
            type: exact.type,
            classDigit: exact.classDigit,
            cppGroup: exact.cppGroup,
            cppLabel: exact.cppLabel,
            special: exact.special,
          }
        : null,
    });
  }

  if (prefix) {
    entries = entries.filter((e) => e.code.startsWith(prefix));
  }

  if (cppGroup) {
    entries = entries.filter((e) => e.cppGroup === cppGroup);
  }

  entries.sort((a, b) => a.code.localeCompare(b.code));

  const MAX = 50;
  const truncated = entries.length > MAX;

  return JSON.stringify({
    query: { prefix, cppGroup },
    total: entries.length,
    showing: Math.min(entries.length, MAX),
    truncated,
    results: entries.slice(0, MAX).map((e) => ({
      code: e.code,
      name: e.name,
      type: e.type,
      cppGroup: e.cppGroup,
      special: e.special,
    })),
  });
}
