import { prisma } from "@/lib/db";
import { getBalanceRows, getActiveEntries } from "@/modules/balances";
import { computeKpis, computeCpp, computeCppF20 } from "@/modules/reporting";
import { loadCppVerticalContext } from "@/modules/reporting/cpp-vertical-context";
import { getCatalogMap } from "@/modules/accounts";
import {
  getRegimeForPeriod,
  taxRegimeLabel,
  taxRegimeAccount,
} from "@/modules/clients/tax-regime";
import { detectTaxRegimeTimeline } from "@/modules/clients/tax-regime-detector";
import { getEmployeeCount, getEmployeeCounts } from "@/modules/clients/employee-counts";
import { computeIndustryKpis, resolveIndustry } from "@/modules/reporting/industry";
import {
  listCategoryTree,
  listMappingVersions,
  buildResolverStateAsOf,
  resolveCategoryForCont,
} from "@/modules/categories";
import {
  resolveAllocationForCont,
  listPartnerAllocations,
  listVerticals,
  type AllocationSplit,
} from "@/modules/verticals";
import {
  loadPartnersForCont,
  loadPartnerTotalsForClient,
  listOverridesForClient,
  type PartnerTotal,
} from "@/modules/partner-mappings";
import { loadMapariCashflowCached } from "@/modules/cache/loaders";
import { getAvailablePeriods } from "@/modules/balances";
import {
  readComputedPeriod,
  writeComputedPeriod,
} from "@/modules/balances/computed-period";
import { buildPeriodPayload } from "@/modules/reporting/period-payload";
import { getContBase } from "@/lib/accounts";
import { recordClientMutation } from "@/modules/audit/helpers";
import {
  aggregateCppByLine,
  computeTrendPoints,
  computeConcentration,
  computeDiagnostic,
  type PeriodFigures,
  type TopPartner,
} from "./analysis";
import { periodKey, periodYear, periodMonth, pickEffective } from "@/lib/period";
import type { CostCategoryNode } from "@/modules/categories/types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

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
    case "get_employee_counts":
      return handleGetEmployeeCounts(userId, input);
    case "get_account_catalog":
      return handleGetAccountCatalog(input);
    case "get_business_lines":
      return handleGetBusinessLines(userId, input);
    case "get_account_mapping_timeline":
      return handleGetAccountMappingTimeline(userId, input);
    case "get_partner_analysis":
      return handleGetPartnerAnalysis(userId, input);
    case "get_mappings_overview":
      return handleGetMappingsOverview(userId, input);
    case "get_trends":
      return handleGetTrends(userId, input);
    case "get_client_diagnostic":
      return handleGetClientDiagnostic(userId, input);
    case "remember_client_fact":
      return handleRememberClientFact(userId, input);
    case "get_client_facts":
      return handleGetClientFacts(userId, input);
    case "forget_client_fact":
      return handleForgetClientFact(userId, input);
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

  const [result, prevResult, catalog, fields, employeeCount] = await Promise.all([
    getBalanceRows(resolved.client.id, year, month),
    getBalanceRows(resolved.client.id, year - 1, month),
    getCatalogMap(),
    prisma.client.findUnique({
      where: { id: resolved.client.id },
      select: { industry: true, industrySource: true, caen: true },
    }),
    getEmployeeCount(resolved.client.id, year, month),
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
    numberOfEmployees: employeeCount,
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

async function handleGetEmployeeCounts(
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const resolved = await resolveClient(userId, input.client_name as string);
  if ("error" in resolved) return JSON.stringify(resolved);

  const counts = await getEmployeeCounts(resolved.client.id);
  const latest = counts.length > 0 ? counts[counts.length - 1] : null;

  return JSON.stringify({
    client: resolved.client.name,
    note: "Numar mediu de angajati pe luna, introdus de contabil in Setari. Pentru lunile fara valoare, foloseste ultima valoare cunoscuta (latest) in calculele per angajat si mentioneaza asta intr-o singura fraza (ex: 'la ultimul numar cunoscut, N angajati in luna M'). NU transforma lipsa intr-o recomandare separata de a completa Setarile.",
    latest,
    counts,
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

  const year = input.year as number;
  const month = input.month as number;
  const [result, catalog, taxRegime, vertical] = await Promise.all([
    getBalanceRows(resolved.client.id, year, month),
    getCatalogMap(),
    getRegimeForPeriod(resolved.client.id, year, month),
    loadCppVerticalContext(resolved.client.id, year, month),
  ]);
  if (!result.ok) return JSON.stringify({ error: "Nu exista date pentru aceasta perioada." });

  const mode = (input.mode as string | undefined) === "f20" ? "f20" : "simplified";
  const verticalNote = vertical
    ? "Defalcare pe linii de business (axa B), conform maparilor lunii selectate. byVertical mapeaza id-ul liniei la suma; suma coloanelor = valoarea totala a randului (fara scurgeri)."
    : undefined;
  const businessLines = vertical?.verticals.map((v) => ({ id: v.id, name: v.name, isDefault: v.isDefault }));

  if (mode === "f20") {
    const cpp = computeCppF20(result.data, catalog, { taxRegime, vertical: vertical ?? undefined });
    return JSON.stringify({
      client: resolved.client.name,
      year,
      month,
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
      businessLines,
      verticalNote,
      // Only non-zero rows — keeps Costi's context tight.
      rows: cpp.lines.filter((l) => l.value !== 0),
    });
  }

  const cpp = computeCpp(result.data, catalog, { taxRegime, vertical: vertical ?? undefined });
  return JSON.stringify({
    client: resolved.client.name,
    year,
    month,
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
    businessLines,
    verticalNote,
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

async function handleGetBusinessLines(
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const resolved = await resolveClient(userId, input.client_name as string);
  if ("error" in resolved) return JSON.stringify(resolved);

  const year = input.year as number;
  const month = input.month as number;

  const [result, catalog, taxRegime, vertical] = await Promise.all([
    getBalanceRows(resolved.client.id, year, month),
    getCatalogMap(),
    getRegimeForPeriod(resolved.client.id, year, month),
    loadCppVerticalContext(resolved.client.id, year, month),
  ]);
  if (!result.ok) return JSON.stringify({ error: "Nu exista date pentru aceasta perioada." });

  if (!vertical) {
    return JSON.stringify({
      client: resolved.client.name,
      year,
      month,
      verticalsEnabled: false,
      note: "Firma nu are linii de business (verticale) activate. Se activeaza din Setari > 'Verticale de business'.",
    });
  }

  const cpp = computeCpp(result.data, catalog, { taxRegime, vertical });
  const { venituri, cheltuieli } = aggregateCppByLine(cpp);

  const lines = vertical.verticals.map((v) => {
    const rev = round2(venituri[v.id] ?? 0);
    const exp = round2(cheltuieli[v.id] ?? 0);
    return {
      id: v.id,
      name: v.name,
      isDefault: v.isDefault,
      venituri: rev,
      cheltuieli: exp,
      rezultat: round2(rev - exp),
    };
  });

  let contSplit: unknown;
  const cont = typeof input.cont === "string" ? input.cont.trim() : "";
  if (cont) {
    const r = resolveAllocationForCont(cont, vertical.resolver);
    const nameById = new Map(vertical.verticals.map((v) => [v.id, v.name]));
    contSplit = {
      cont,
      matchedScope: r.matchedScope,
      splits: r.splits.map((s) => ({
        line: nameById.get(s.verticalId) ?? s.verticalId,
        percent: s.percent,
      })),
    };
  }

  return JSON.stringify({
    client: resolved.client.name,
    year,
    month,
    verticalsEnabled: true,
    note: "Venituri/cheltuieli/rezultat cumulate ianuarie -> luna selectata (YTD, pre-impozit), defalcate conform maparilor lunii. 'Toata firma' este verticala default care absoarbe regia nealocata. Suma liniilor = totalul firmei.",
    firmTotals: {
      venituri: round2(cpp.venituriExploatare + cpp.venituriFinanciare),
      cheltuieli: round2(cpp.cheltuieliExploatare + cpp.cheltuieliFinanciare),
      rezultatBrut: cpp.rezultatBrut,
    },
    lines,
    contSplit,
  });
}

async function handleGetAccountMappingTimeline(
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const resolved = await resolveClient(userId, input.client_name as string);
  if ("error" in resolved) return JSON.stringify(resolved);

  const cont = String(input.cont ?? "").trim();
  if (!cont) return JSON.stringify({ error: "Lipseste contul." });

  const [{ tree }, versions] = await Promise.all([
    listCategoryTree(prisma, resolved.client.id, { autoSeed: false }),
    listMappingVersions(prisma, resolved.client.id),
  ]);
  const nameById = new Map<string, string>();
  const walk = (nodes: typeof tree) => {
    for (const n of nodes) {
      nameById.set(n.id, n.name);
      walk(n.children);
    }
  };
  walk(tree);

  // Direct versions on this exact cont key, oldest first.
  const direct = versions
    .filter((v) => v.cont === cont)
    .sort((a, b) => a.effectiveFrom - b.effectiveFrom)
    .map((v) => ({
      effectiveFrom: v.effectiveFrom,
      from: v.effectiveFrom === 0 ? "de la inceput" : describePeriod(v.effectiveFrom),
      effectiveTo: v.effectiveTo,
      to: v.effectiveTo === null ? null : describePeriod(v.effectiveTo),
      kind: v.effectiveTo === null ? "open" : "bounded",
      line: v.categoryId ? nameById.get(v.categoryId) ?? v.categoryId : null,
      tombstone: v.categoryId === null,
    }));

  // Optional: resolved active line for a specific month (full prefix-walk).
  let resolvedForMonth: { year: number; month: number; line: string | null } | null = null;
  if (typeof input.year === "number" && typeof input.month === "number") {
    const p = periodKey(input.year, input.month);
    const state = buildResolverStateAsOf(tree, versions, p);
    const r = resolveCategoryForCont(cont, state);
    resolvedForMonth = {
      year: input.year,
      month: input.month,
      line: r ? r.category.name : null,
    };
  }

  // The directly-effective version for the queried month (no prefix walk).
  const directNow =
    typeof input.year === "number" && typeof input.month === "number"
      ? pickEffective(
          versions.filter((v) => v.cont === cont),
          periodKey(input.year, input.month)
        )
      : null;

  return JSON.stringify({
    client: resolved.client.name,
    cont,
    versions: direct,
    versionCount: direct.length,
    isPeriodScoped: direct.some((v) => v.effectiveFrom !== 0 || v.effectiveTo !== null),
    resolvedForMonth,
    directlyEffectiveLine: directNow
      ? directNow.categoryId
        ? nameById.get(directNow.categoryId) ?? directNow.categoryId
        : "nemapat (tombstone)"
      : undefined,
    note:
      "Versiunile deschise (effectiveTo null) se aplica de la luna lor inainte; exceptiile marginite (effectiveTo setat) doar in fereastra lor. effectiveFrom=0 inseamna 'de la inceput' (legacy, fara perioade).",
  });
}

function describePeriod(key: number): string {
  return `${String(periodMonth(key)).padStart(2, "0")}.${periodYear(key)}`;
}

const DEFAULT_PARTNER_RESULTS = 15;
const MAX_PARTNER_RESULTS = 30;
const MAX_CONTS_PER_CATEGORY = 8;
const MAX_UNMAPPED_ROWS = 15;
const DEFAULT_TREND_MONTHS = 12;
const MAX_TREND_MONTHS = 24;

function walkCategoryNames(tree: CostCategoryNode[]): Map<string, string> {
  const names = new Map<string, string>();
  const walk = (nodes: CostCategoryNode[], prefix: string) => {
    for (const n of nodes) {
      const path = prefix ? `${prefix} > ${n.name}` : n.name;
      names.set(n.id, path);
      walk(n.children, path);
    }
  };
  walk(tree, "");
  return names;
}

function namedSplits(
  splits: AllocationSplit[],
  nameById: Map<string, string>
): Array<{ line: string; percent: number }> {
  return splits.map((s) => ({
    line: nameById.get(s.verticalId) ?? s.verticalId,
    percent: s.percent,
  }));
}

function sharePct(amount: number, total: number): number | null {
  return total !== 0 ? round2((Math.abs(amount) / Math.abs(total)) * 100) : null;
}

async function handleGetPartnerAnalysis(
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const resolved = await resolveClient(userId, input.client_name as string);
  if ("error" in resolved) return JSON.stringify(resolved);

  const year = input.year as number;
  const month = input.month as number;
  const limit = Math.min(
    (input.limit as number) || DEFAULT_PARTNER_RESULTS,
    MAX_PARTNER_RESULTS
  );
  const cont = typeof input.cont === "string" ? input.cont.trim() : "";

  return cont
    ? partnerAnalysisForCont(resolved.client, cont, year, month, limit)
    : partnerAnalysisForFirm(resolved.client, year, month, limit);
}

async function partnerAnalysisForCont(
  client: { id: string; name: string },
  cont: string,
  year: number,
  month: number,
  limit: number
): Promise<string> {
  const contBase = getContBase(cont);
  const classDigit = contBase.charAt(0);
  if (classDigit !== "6" && classDigit !== "7") {
    return JSON.stringify({
      error:
        "Analiza de parteneri exista doar pentru conturi de cheltuieli (6xx) sau venituri (7xx).",
    });
  }

  const [agg, pins, treeResult, verticals] = await Promise.all([
    loadPartnersForCont(prisma, client.id, contBase, year, month),
    listPartnerAllocations(prisma, client.id, contBase),
    listCategoryTree(prisma, client.id, { autoSeed: false }),
    listVerticals(prisma, client.id),
  ]);
  const categoryNames = walkCategoryNames(treeResult.tree);
  const verticalNames = new Map(verticals.map((v) => [v.id, v.name]));
  const pinByPartner = new Map(pins.map((p) => [p.partnerNameNormalized, p.splits]));

  const total = round2(agg.partnerRulaj + agg.unresolvedRulaj);
  const partners = [...agg.partners].sort(
    (a, b) => Math.abs(b.rulaj) - Math.abs(a.rulaj)
  );
  const rows = partners.slice(0, limit).map((p) => {
    const pin = pinByPartner.get(p.nameNormalized);
    return {
      partener: p.nameOriginal,
      rulaj: p.rulaj,
      pondereDinCont: sharePct(p.rulaj, total),
      exceptieCategorie: p.override
        ? {
            linie: categoryNames.get(p.override.categoryId) ?? p.override.categoryId,
            confirmata: p.override.confirmedAt !== null,
            sursa: p.override.source,
          }
        : undefined,
      sugestieCategorie:
        !p.override && p.suggestedCategoryId
          ? categoryNames.get(p.suggestedCategoryId) ?? p.suggestedCategoryId
          : undefined,
      pinLiniiBusiness: pin ? namedSplits(pin, verticalNames) : undefined,
    };
  });

  return JSON.stringify({
    client: client.name,
    year,
    month,
    cont: contBase,
    kind: classDigit === "6" ? "cheltuiala" : "venit",
    totalRulaj: total,
    partnerRulaj: agg.partnerRulaj,
    unresolvedRulaj: agg.unresolvedRulaj,
    partnerCount: partners.length,
    showing: rows.length,
    concentration: computeConcentration(partners.map((p) => p.rulaj), total),
    partners: rows,
    note:
      "Rulaj cumulat YTD ianuarie -> luna selectata. 'unresolvedRulaj' = miscari fara partener identificat (TVA, dobanzi, transferuri interne). Ponderile si concentrarea sunt raportate la totalul contului, inclusiv partea nerezolvata.",
  });
}

async function partnerAnalysisForFirm(
  client: { id: string; name: string },
  year: number,
  month: number,
  limit: number
): Promise<string> {
  const [totals, pins, overrides] = await Promise.all([
    loadPartnerTotalsForClient(prisma, client.id, year, month),
    listPartnerAllocations(prisma, client.id),
    listOverridesForClient(prisma, client.id),
  ]);

  const side = (list: PartnerTotal[], total: number, unresolved: number) => ({
    total: round2(total),
    unresolvedRulaj: unresolved,
    partnerCount: list.length,
    concentration: computeConcentration(list.map((p) => p.rulaj), total),
    top: list.slice(0, limit).map((p) => ({
      partener: p.partnerNameOriginal,
      rulaj: p.rulaj,
      pondere: sharePct(p.rulaj, total),
      conturi: p.contBases,
    })),
  });

  return JSON.stringify({
    client: client.name,
    year,
    month,
    venituri: side(totals.revenue, totals.totalRevenue, totals.unresolvedRevenue),
    cheltuieli: side(totals.expense, totals.totalExpense, totals.unresolvedExpense),
    exceptiiCategorie: overrides.length,
    pinuriLiniiBusiness: pins.length,
    note:
      "Rulaj cumulat YTD ianuarie -> luna selectata, agregat pe toata firma. Ponderile si concentrarea (top1/top3/top5) sunt raportate la totalul fiecarei parti, inclusiv rulajul fara partener identificat. Pentru detaliul unui cont (exceptii, pin-uri, sugestii), apeleaza din nou cu parametrul 'cont'.",
  });
}

async function handleGetMappingsOverview(
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const resolved = await resolveClient(userId, input.client_name as string);
  if ("error" in resolved) return JSON.stringify(resolved);

  const year = typeof input.year === "number" ? input.year : undefined;
  const month = typeof input.month === "number" ? input.month : undefined;
  const data = await loadMapariCashflowCached(resolved.client.id, { year, month });
  if (!data.period) {
    return JSON.stringify({ error: "Clientul nu are date in jurnal." });
  }

  const categoryNames = walkCategoryNames(data.tree);
  const verticalNames = new Map(data.verticals.map((v) => [v.id, v.name]));
  const catAllocByCategory = new Map(
    data.categoryAllocations.map((a) => [a.categoryId, a.splits])
  );

  type Acc = (typeof data.accounts)[number];
  const rulajOf = (a: Acc) => (a.kind === "expense" ? a.rulajD : a.rulajC);
  const byRulajDesc = (x: Acc, y: Acc) => Math.abs(rulajOf(y)) - Math.abs(rulajOf(x));

  const byCategory = new Map<string, Acc[]>();
  const unmapped: Acc[] = [];
  for (const a of data.accounts) {
    if (!a.currentMapping) {
      unmapped.push(a);
      continue;
    }
    const bucket = byCategory.get(a.currentMapping.categoryId);
    if (bucket) bucket.push(a);
    else byCategory.set(a.currentMapping.categoryId, [a]);
  }

  const linii = Array.from(byCategory.entries())
    .map(([catId, accounts]) => {
      const sorted = [...accounts].sort(byRulajDesc);
      const catSplits = catAllocByCategory.get(catId);
      return {
        linie: categoryNames.get(catId) ?? catId,
        kind: accounts[0].kind === "expense" ? "cheltuiala" : "venit",
        rulaj: round2(accounts.reduce((s, a) => s + rulajOf(a), 0)),
        contCount: accounts.length,
        splitLiniiBusiness: catSplits ? namedSplits(catSplits, verticalNames) : undefined,
        conturi: sorted.slice(0, MAX_CONTS_PER_CATEGORY).map((a) => ({
          cont: a.cont,
          denumire: a.denumire,
          rulaj: round2(rulajOf(a)),
          sursaSplitLinii: data.verticalsEnabled ? a.effectiveAllocation.source : undefined,
          parteneri: a.partnerCount || undefined,
          exceptiiParteneri: a.partnerOverrideCount || undefined,
          pinuriParteneri: a.partnerLobOverrideCount || undefined,
        })),
        conturiTrunchiate: accounts.length > MAX_CONTS_PER_CATEGORY || undefined,
      };
    })
    .sort((a, b) => Math.abs(b.rulaj) - Math.abs(a.rulaj));

  const redirectionari = Object.entries(data.categoryInflows).map(([catId, inf]) => ({
    linie: categoryNames.get(catId) ?? catId,
    amount: inf.amount,
  }));

  return JSON.stringify({
    client: resolved.client.name,
    period: data.period,
    coverage: data.coverage,
    verticalsEnabled: data.verticalsEnabled,
    liniiBusiness: data.verticals.map((v) => ({ name: v.name, isDefault: v.isDefault })),
    splitDefaultFirma: data.firmDefaultSplits
      ? namedSplits(data.firmDefaultSplits, verticalNames)
      : null,
    linii,
    nemapate: {
      count: unmapped.length,
      rulaj: data.coverage.unmappedRulaj,
      top: [...unmapped].sort(byRulajDesc).slice(0, MAX_UNMAPPED_ROWS).map((a) => ({
        cont: a.cont,
        denumire: a.denumire,
        rulaj: round2(rulajOf(a)),
      })),
    },
    redirectionariExceptii: redirectionari.length > 0 ? redirectionari : undefined,
    reziduuAbsorbitDeDefault: data.defaultVerticalResidueAbsorbed || undefined,
    note:
      "Rulaj YTD ianuarie -> luna perioadei. 'sursaSplitLinii' spune de unde vine splitul pe linii de business al contului: own (regula proprie) / category (mosteneste linia de cost) / firm (splitul default al firmei) / default (fallback pe verticala default). 'redirectionariExceptii' = rulaj mutat intre linii de cost de exceptiile de partener.",
  });
}

const DIAGNOSTIC_TREND_PERIODS = 13;
const MAX_TOP_PARTNERS = 5;
const MAX_FACT_KEY_LENGTH = 100;
const MAX_FACT_VALUE_LENGTH = 500;

async function handleGetClientDiagnostic(
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const resolved = await resolveClient(userId, input.client_name as string);
  if ("error" in resolved) return JSON.stringify(resolved);
  const clientId = resolved.client.id;

  const all = await getAvailablePeriods(clientId);
  if (all.length === 0) {
    return JSON.stringify({ error: "Clientul nu are date in jurnal." });
  }
  const latest = all[all.length - 1];

  const [figures, partnerTotals, mapari, employeeCounts, facts, lastEntry] =
    await Promise.all([
      loadPeriodFigures(clientId, all.slice(-DIAGNOSTIC_TREND_PERIODS)),
      loadPartnerTotalsForClient(prisma, clientId, latest.year, latest.month),
      loadMapariCashflowCached(clientId, { year: latest.year, month: latest.month }),
      getEmployeeCounts(clientId),
      prisma.clientFact.findMany({ where: { clientId }, orderBy: { key: "asc" } }),
      prisma.journalLine.aggregate({
        where: { clientId, deletedAt: null },
        _max: { data: true },
      }),
    ]);

  const latestFigure = figures.find(
    (f) => f.year === latest.year && f.month === latest.month
  );
  if (!latestFigure?.kpis || !latestFigure.cpp) {
    return JSON.stringify({ error: "Nu am putut calcula perioada curenta." });
  }
  const kpis = latestFigure.kpis;
  const trend = computeTrendPoints(figures);

  const topPartners: TopPartner[] = partnerTotals.revenue
    .slice(0, MAX_TOP_PARTNERS)
    .map((p) => ({
      name: p.partnerNameOriginal,
      rulaj: round2(p.rulaj),
      pct:
        partnerTotals.totalRevenue !== 0
          ? round2((p.rulaj / partnerTotals.totalRevenue) * 100)
          : 0,
    }));

  let defaultLineShare: { venituriPct: number; cheltuieliPct: number } | null = null;
  const verticals = latestFigure.cpp.verticals;
  if (verticals && verticals.length > 0) {
    const defaultVertical = verticals.find((v) => v.isDefault);
    if (defaultVertical) {
      const byLine = aggregateCppByLine(latestFigure.cpp);
      const totalV = Object.values(byLine.venituri).reduce((s, v) => s + v, 0);
      const totalC = Object.values(byLine.cheltuieli).reduce((s, v) => s + v, 0);
      defaultLineShare = {
        venituriPct:
          totalV !== 0
            ? round2(((byLine.venituri[defaultVertical.id] ?? 0) / totalV) * 100)
            : 0,
        cheltuieliPct:
          totalC !== 0
            ? round2(((byLine.cheltuieli[defaultVertical.id] ?? 0) / totalC) * 100)
            : 0,
      };
    }
  }

  const lastCount =
    employeeCounts.length > 0 ? employeeCounts[employeeCounts.length - 1] : null;
  const employee = lastCount
    ? {
        count: Number(lastCount.count),
        year: lastCount.year,
        month: lastCount.month,
        staleMonths:
          (latest.year - lastCount.year) * 12 + (latest.month - lastCount.month),
      }
    : null;

  const diagnostic = computeDiagnostic({
    latest,
    kpis,
    trend,
    topPartners,
    unmapped: {
      count: mapari.coverage.unmappedCount,
      rulaj: round2(mapari.coverage.unmappedRulaj),
    },
    defaultLineShare,
    employee,
  });

  return JSON.stringify({
    client: resolved.client.name,
    ancora: {
      year: latest.year,
      month: latest.month,
      ultimaInregistrare: lastEntry._max.data?.toISOString().slice(0, 10) ?? null,
      lunaPartialaSuspecta: diagnostic.lunaPartialaSuspecta,
    },
    semnale: diagnostic.flags,
    cifre: {
      cash: round2(kpis.cashBank),
      creanteClienti: round2(kpis.clientiCreante),
      datoriiFurnizori: round2(kpis.furnizoriDatorii),
      tvaDePlata: round2(kpis.tvaDePlata),
      venituriYtd: round2(kpis.totalVenituri),
      cheltuieliYtd: round2(kpis.totalCheltuieli),
      rezultatYtd: round2(kpis.rezultat),
      marjaYtdPct: kpis.marjaOperationala,
      burnLunar: diagnostic.burnLunar,
      runwayLuni: diagnostic.runwayLuni,
      marjaTrend: diagnostic.marjaTrend,
    },
    topClienti: topPartners,
    acoperireMapari: {
      percent: mapari.coverage.percent,
      conturiNemapate: mapari.coverage.unmappedCount,
    },
    liniiBusiness: defaultLineShare
      ? { procentPeLiniaDefault: defaultLineShare }
      : null,
    angajati: employee,
    fapteCunoscute: facts.map((f) => ({
      key: f.key,
      value: f.value,
      sursa: f.source,
      actualizat: f.updatedAt.toISOString().slice(0, 10),
    })),
    note:
      "Diagnosticul e calculat pe ultima perioada din jurnal si trendul lunar. 'semnale' sunt constatari pre-calculate, ordonate dupa severitate: construieste verdictul din ele, incepand cu alarmele. 'fapteCunoscute' sunt memoria ta despre firma (salvate cu remember_client_fact): foloseste-le natural in raspuns. Cifrele YTD sunt ianuarie -> luna ancorei.",
  });
}

async function handleRememberClientFact(
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const resolved = await resolveClient(userId, input.client_name as string);
  if ("error" in resolved) return JSON.stringify(resolved);

  const key = typeof input.key === "string" ? input.key.trim() : "";
  const value = typeof input.value === "string" ? input.value.trim() : "";
  if (!key || !value) {
    return JSON.stringify({ error: "key si value sunt obligatorii." });
  }
  if (key.length > MAX_FACT_KEY_LENGTH || value.length > MAX_FACT_VALUE_LENGTH) {
    return JSON.stringify({
      error: `key max ${MAX_FACT_KEY_LENGTH} caractere, value max ${MAX_FACT_VALUE_LENGTH}.`,
    });
  }
  const source = input.source === "costi" ? "costi" : "user";

  const existing = await prisma.clientFact.findUnique({
    where: { clientId_key: { clientId: resolved.client.id, key } },
  });
  const fact = await prisma.clientFact.upsert({
    where: { clientId_key: { clientId: resolved.client.id, key } },
    create: { clientId: resolved.client.id, key, value, source },
    update: { value, source },
  });
  await recordClientMutation({
    clientId: resolved.client.id,
    actorId: userId,
    action: existing ? "update" : "create",
    entityType: "client_fact",
    entityId: fact.id,
    before: existing ? { key: existing.key, value: existing.value } : null,
    after: { key, value, source },
    metadata: { via: "costi_chat" },
  });

  return JSON.stringify({
    saved: { key, value, source },
    replaced: existing ? existing.value : null,
    note: "Fapt salvat in memoria clientului. Il vei primi automat in get_client_diagnostic si get_client_facts in orice conversatie viitoare.",
  });
}

async function handleGetClientFacts(
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const resolved = await resolveClient(userId, input.client_name as string);
  if ("error" in resolved) return JSON.stringify(resolved);

  const facts = await prisma.clientFact.findMany({
    where: { clientId: resolved.client.id },
    orderBy: { key: "asc" },
  });
  return JSON.stringify({
    client: resolved.client.name,
    count: facts.length,
    facts: facts.map((f) => ({
      key: f.key,
      value: f.value,
      sursa: f.source,
      actualizat: f.updatedAt.toISOString().slice(0, 10),
    })),
  });
}

async function handleForgetClientFact(
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const resolved = await resolveClient(userId, input.client_name as string);
  if ("error" in resolved) return JSON.stringify(resolved);

  const key = typeof input.key === "string" ? input.key.trim() : "";
  if (!key) return JSON.stringify({ error: "key este obligatoriu." });

  const existing = await prisma.clientFact.findUnique({
    where: { clientId_key: { clientId: resolved.client.id, key } },
  });
  if (!existing) {
    return JSON.stringify({ error: `Nu exista faptul "${key}" pentru acest client.` });
  }
  await prisma.clientFact.delete({ where: { id: existing.id } });
  await recordClientMutation({
    clientId: resolved.client.id,
    actorId: userId,
    action: "delete",
    entityType: "client_fact",
    entityId: existing.id,
    before: { key: existing.key, value: existing.value },
    after: null,
    metadata: { via: "costi_chat" },
  });

  return JSON.stringify({ deleted: { key, value: existing.value } });
}

async function loadPeriodFigures(
  clientId: string,
  periods: { year: number; month: number }[]
): Promise<PeriodFigures[]> {
  const figures: PeriodFigures[] = [];
  for (const p of periods) {
    const cached = await readComputedPeriod(clientId, p.year, p.month);
    if (cached) {
      figures.push({ year: p.year, month: p.month, kpis: cached.kpis, cpp: cached.cpp });
      continue;
    }
    const payload = await buildPeriodPayload(clientId, p.year, p.month);
    if (!payload) continue;
    await writeComputedPeriod(clientId, p.year, p.month, payload);
    figures.push({ year: p.year, month: p.month, kpis: payload.kpis, cpp: payload.cpp });
  }
  return figures;
}

async function handleGetTrends(
  userId: string,
  input: Record<string, unknown>
): Promise<string> {
  const resolved = await resolveClient(userId, input.client_name as string);
  if ("error" in resolved) return JSON.stringify(resolved);

  const months = Math.min(
    (input.months as number) || DEFAULT_TREND_MONTHS,
    MAX_TREND_MONTHS
  );
  const includeLines = input.include_business_lines === true;

  const all = await getAvailablePeriods(resolved.client.id);
  if (all.length === 0) {
    return JSON.stringify({ error: "Clientul nu are date in jurnal." });
  }

  const toYear = input.to_year as number | undefined;
  const toMonth = input.to_month as number | undefined;
  const eligible =
    toYear !== undefined && toMonth !== undefined
      ? all.filter((p) => p.year < toYear || (p.year === toYear && p.month <= toMonth))
      : all;
  if (eligible.length === 0) {
    return JSON.stringify({ error: "Nu exista date pana la perioada ceruta." });
  }

  // One extra period before the window (same fiscal year only) so the first
  // point's delta subtracts a real baseline instead of falling back to YTD.
  const window = eligible.slice(-months);
  const startIdx = eligible.length - window.length;
  const withBaseline =
    startIdx > 0 && eligible[startIdx - 1].year === window[0].year
      ? eligible.slice(startIdx - 1)
      : window;

  const figures = await loadPeriodFigures(resolved.client.id, withBaseline);

  const first = window[0];
  const points = computeTrendPoints(figures, includeLines).filter(
    (pt) => pt.year > first.year || (pt.year === first.year && pt.month >= first.month)
  );

  return JSON.stringify({
    client: resolved.client.name,
    months: points.length,
    points,
    note:
      "Venituri, cheltuieli, rezultatBrut si marjaPct sunt fluxuri PE LUNA (derivate din snapshot-urile YTD ale CPP, cu reset in ianuarie). 'cash' e pozitia la finalul lunii (punctuala, nu flux). 'monthsCovered' > 1 inseamna ca jurnalul sare peste luni si fluxul acopera tot intervalul. 'byLine' apare doar cu include_business_lines si verticale active.",
  });
}
