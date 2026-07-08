import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  buildSystemPrompt,
  getChatParams,
  isCfoModeEnabled,
} from "@/modules/costi/prompt";
import { COSTI_TOOLS } from "@/modules/costi/tools";

const PLAYBOOKS_PATH = join(process.cwd(), "training/cfo/structured/cfo-playbooks.json");

function loadPlaybooks() {
  return JSON.parse(readFileSync(PLAYBOOKS_PATH, "utf-8"));
}

afterEach(() => {
  delete process.env.COSTI_CFO_MODE;
});

describe("COSTI_CFO_MODE flag", () => {
  it("is off by default", () => {
    delete process.env.COSTI_CFO_MODE;
    expect(isCfoModeEnabled()).toBe(false);
  });

  it("is on only for the exact value 'on'", () => {
    process.env.COSTI_CFO_MODE = "on";
    expect(isCfoModeEnabled()).toBe(true);
    process.env.COSTI_CFO_MODE = "true";
    expect(isCfoModeEnabled()).toBe(false);
    process.env.COSTI_CFO_MODE = "off";
    expect(isCfoModeEnabled()).toBe(false);
  });
});

describe("getChatParams", () => {
  it("legacy mode keeps the exact pre-CFO parameters", () => {
    expect(getChatParams(false)).toEqual({
      model: "claude-haiku-4-5-20251001",
      maxTokens: 2048,
      temperature: 0.1,
      maxToolRounds: 5,
    });
  });

  it("cfo mode upgrades model, tokens, temperature and tool rounds", () => {
    const p = getChatParams(true);
    expect(p.model).toBe("claude-sonnet-4-5");
    expect(p.maxTokens).toBe(4096);
    expect(p.temperature).toBe(0.3);
    expect(p.maxToolRounds).toBe(8);
  });

  it("reads the env flag when no argument is given", () => {
    process.env.COSTI_CFO_MODE = "on";
    expect(getChatParams().model).toBe("claude-sonnet-4-5");
    delete process.env.COSTI_CFO_MODE;
    expect(getChatParams().model).toBe("claude-haiku-4-5-20251001");
  });
});

describe("buildSystemPrompt: legacy mode (flag off)", () => {
  it("contains all legacy sections and no CFO section", () => {
    const prompt = buildSystemPrompt("cat e TVA?", false);
    for (const section of [
      "CINE ESTI:",
      "REGULI TOOL-URI:",
      "REGULI GENERALE:",
      "FORMATARE:",
      "PLATFORMA COSTIFY:",
      "DATE FISCALE 2026:",
      "CALENDAR FISCAL:",
      "PAYROLL:",
      "CORPORATE:",
      "SANCTIUNI:",
    ]) {
      expect(prompt).toContain(section);
    }
    expect(prompt).not.toContain("MOD CFO");
    expect(prompt).not.toContain("CFO_PLAYBOOKS");
  });

  it("keeps the historical pretty-printed JSON (rollback fidelity)", () => {
    const prompt = buildSystemPrompt("intrebare", false);
    // Pretty-print signature: top-level key indented on its own line.
    expect(prompt).toMatch(/\{\n {2}"app": \{/);
  });

  it("loads the Saga guide only for Saga keywords", () => {
    expect(buildSystemPrompt("cum fac inchidere luna in saga?", false)).toContain("GHID SAGA C:");
    expect(buildSystemPrompt("cat cash are clientul?", false)).not.toContain("GHID SAGA C:");
  });
});

describe("buildSystemPrompt: CFO mode (flag on)", () => {
  it("injects the CFO section with playbooks", () => {
    const prompt = buildSystemPrompt("de ce scade marja?", true);
    expect(prompt).toContain("MOD CFO (ACTIV):");
    expect(prompt).toContain("CFO_PLAYBOOKS:");
    expect(prompt).toContain("Regula de comutare");
  });

  it("contains all 16 playbook ids", () => {
    const prompt = buildSystemPrompt("test", true);
    for (let i = 0; i <= 15; i++) {
      const id = `P${String(i).padStart(2, "0")}`;
      expect(prompt, `missing playbook ${id}`).toContain(`"id":"${id}"`);
    }
  });

  it("compacts the knowledge JSONs (no pretty-print)", () => {
    const prompt = buildSystemPrompt("test", true);
    expect(prompt).not.toMatch(/\{\n {2}"app": \{/);
    expect(prompt).toContain('{"app":{');
  });

  it("keeps every legacy section (CFO mode is additive)", () => {
    const prompt = buildSystemPrompt("test", true);
    for (const section of [
      "CINE ESTI:",
      "PLATFORMA COSTIFY:",
      "DATE FISCALE 2026:",
      "SANCTIUNI:",
    ]) {
      expect(prompt).toContain(section);
    }
  });

  it("keeps the Saga keyword trigger", () => {
    expect(buildSystemPrompt("configurare societati saga", true)).toContain("GHID SAGA C:");
  });

  it("states the no-budget rule and the legacy-table scoping", () => {
    const prompt = buildSystemPrompt("test", true);
    expect(prompt.toLowerCase()).toContain("nu invoca niciodata \"buget\"");
    expect(prompt).toContain("Concluzie Sintetica ramane DOAR pentru intrebari de legislatie");
  });

  it("mandates diagnostic-first for client conversations", () => {
    const prompt = buildSystemPrompt("test", true);
    expect(prompt).toContain("DIAGNOSTIC INTAI:");
    expect(prompt).toContain("PRIMUL apel este get_client_diagnostic");
  });

  it("carries the anti-generic style rules", () => {
    const prompt = buildSystemPrompt("test", true);
    expect(prompt).toContain("ANTI-GENERIC");
    expect(prompt).toContain("Prima propozitie a raspunsului este VERDICTUL");
    expect(prompt).toContain("NU incheia cu meniu de optiuni");
    expect(prompt).toContain("NU anunta ce urmeaza sa faci");
  });

  it("carries the client-memory rules", () => {
    const prompt = buildSystemPrompt("test", true);
    expect(prompt).toContain("MEMORIA CLIENTULUI:");
    expect(prompt).toContain("remember_client_fact");
    expect(prompt).toContain("NU salva niciodata cifre calculabile");
  });
});

describe("cfo-playbooks.json content", () => {
  it("is valid JSON with 16 playbooks and unique ids", () => {
    const pb = loadPlaybooks();
    expect(pb.playbooks).toHaveLength(16);
    const ids = pb.playbooks.map((p: { id: string }) => p.id);
    expect(new Set(ids).size).toBe(16);
    expect(ids[0]).toBe("P00");
    expect(ids[15]).toBe("P15");
  });

  it("every playbook has declansator, tools and metoda", () => {
    const pb = loadPlaybooks();
    for (const p of pb.playbooks) {
      expect(p.declansator, `${p.id} missing declansator`).toBeTruthy();
      expect(Array.isArray(p.tools) && p.tools.length > 0, `${p.id} missing tools`).toBe(true);
      expect(p.metoda, `${p.id} missing metoda`).toBeTruthy();
    }
  });

  it("references only tools that actually exist", () => {
    const pb = loadPlaybooks();
    const known = new Set(COSTI_TOOLS.map((t) => t.name));
    for (const p of pb.playbooks) {
      for (const tool of p.tools) {
        expect(known.has(tool), `${p.id} references unknown tool "${tool}"`).toBe(true);
      }
    }
  });

  it("has identity, mode_switch, response contract and facts_wanted", () => {
    const pb = loadPlaybooks();
    expect(pb.identity).toHaveLength(6);
    expect(pb.mode_switch).toBeTruthy();
    expect(pb.response_contract.skeleton).toBeTruthy();
    expect(pb.response_contract.exception_rule).toContain("10%");
    expect(pb.response_contract.jargon_guard_patron.interzise.length).toBeGreaterThan(5);
    expect(pb.facts_wanted.length).toBe(10);
  });

  it("contains no em dash anywhere (user-facing Romanian rule)", () => {
    const raw = readFileSync(PLAYBOOKS_PATH, "utf-8");
    expect(raw.includes("\u2014")).toBe(false);
  });

  it("stays within the prompt token budget (compact <= 21k chars)", () => {
    const compact = JSON.stringify(loadPlaybooks());
    expect(compact.length).toBeLessThanOrEqual(21_000);
  });

  it("verdict examples respect the patron jargon guard", () => {
    const pb = loadPlaybooks();
    const banned = [/\bDSO\b/, /\bEBITDA\b/, /\brulaj\b/i, /\bdebit\b/i, /\bcredit contabil\b/i, /\bbalanta\b/i, /\banalitic\b/i];
    for (const p of pb.playbooks) {
      if (!p.exemplu_patron) continue;
      for (const re of banned) {
        expect(re.test(p.exemplu_patron), `${p.id} patron example violates jargon guard: ${re}`).toBe(false);
      }
    }
  });
});
