import { describe, it, expect } from "vitest";
import { runChecks, type TurnOutcome } from "@/modules/costi/golden/checks";

function outcome(text: string, tools: string[] = []): TurnOutcome {
  return {
    text,
    toolCalls: tools.map((name, i) => ({
      round: i === 0 ? 0 : 1,
      name,
      input: {},
      result: "{}",
    })),
  };
}

function failedIds(o: TurnOutcome, exp: Parameters<typeof runChecks>[1]): string[] {
  return runChecks(o, exp)
    .filter((c) => !c.ok)
    .map((c) => c.id);
}

describe("golden checks: narration", () => {
  it("fails answers that open with transition narration", () => {
    for (const bad of [
      "Să verific situația financiară.",
      "Sa vad ce firme ai in platforma.",
      "Voi analiza evoluția marjei.",
      "Îți verific datele acum.",
    ]) {
      expect(failedIds(outcome(bad), {})).toContain("no_narration");
    }
  });

  it("passes verdict-first answers", () => {
    expect(
      failedIds(outcome("Cash negativ și dependență de Roche — două alarme."), {})
    ).toHaveLength(0);
  });
});

describe("golden checks: closing menus", () => {
  it("fails the option-menu ending", () => {
    const text = "Rezultat bun.\n\nDorești să analizăm ceva specific? Pot să îți arăt:\n- Evoluția lunară";
    expect(failedIds(outcome(text), {})).toContain("no_closing_menu");
  });

  it("allows a single closing question", () => {
    const text = "Rezultat bun.\n\nVrei să vedem cine îți datorează cei 702.531 lei?";
    expect(failedIds(outcome(text), {})).toHaveLength(0);
  });
});

describe("golden checks: memory honesty", () => {
  it("fails 'am retinut' without the tool call", () => {
    expect(failedIds(outcome("Am reținut ambele informații."), {})).toContain(
      "memory_honesty"
    );
  });

  it("passes the claim when remember_client_fact was called", () => {
    expect(
      failedIds(outcome("Am reținut.", ["remember_client_fact"]), {})
    ).toHaveLength(0);
  });

  it("passes honest recall when a read tool returned existing facts", () => {
    const o: TurnOutcome = {
      text: "Din discutiile trecute am reținut doua lucruri.",
      toolCalls: [
        {
          round: 0,
          name: "get_client_facts",
          input: {},
          result: '{"count":2,"facts":[{"key":"cost_behavior.641","value":"fixe"}]}',
        },
      ],
    };
    expect(failedIds(o, {})).toHaveLength(0);
  });

  it("still fails recall claims when memory is empty", () => {
    const o: TurnOutcome = {
      text: "Am reținut ca salariile sunt fixe.",
      toolCalls: [
        { round: 0, name: "get_client_facts", input: {}, result: '{"count":0,"facts":[]}' },
      ],
    };
    expect(failedIds(o, {})).toContain("memory_honesty");
  });
});

describe("golden checks: patron jargon guard", () => {
  it("catches account codes, rulaj, sold and DSO", () => {
    for (const bad of [
      "Soldul contului 4111 este mare.",
      "Rulajul lunii e stabil.",
      "DSO este 72 de zile.",
      "Salarii (641 + 6461) sunt fixe.",
    ]) {
      expect(failedIds(outcome(bad), { patronVoice: true })).toContain(
        "patron_jargon_guard"
      );
    }
  });

  it("allows owner-speech including bank credit and amounts", () => {
    const text =
      "Ai 115.000 lei în bancă. Ratele la credit sunt 6.000 lei pe lună. Din fiecare 100 lei încasați îți rămân 18.";
    expect(failedIds(outcome(text), { patronVoice: true })).toHaveLength(0);
  });

  it("allows 'sold' in the banking sense but not the accounting sense", () => {
    for (const ok of [
      "Verifica extrasul: daca banca arată un sold diferit, lipsesc incasari.",
      "Soldul contului de la bancă e -28.073 lei.",
      "Sold disponibil: 115.000 lei.",
      "Soldul negativ trebuie confirmat cu banca.",
    ]) {
      expect(failedIds(outcome(ok), { patronVoice: true })).toHaveLength(0);
    }
    for (const bad of [
      "Soldul creditor al furnizorilor e mare.",
      "Sold debitor pe clienti.",
      "Soldul contului 4111 e 702.530 lei.",
    ]) {
      expect(failedIds(outcome(bad), { patronVoice: true })).toContain(
        "patron_jargon_guard"
      );
    }
  });

  it("does not apply outside patron voice", () => {
    expect(
      failedIds(outcome("Soldul 4111 este 702.530 lei."), { patronVoice: false })
    ).toHaveLength(0);
  });
});

describe("golden checks: tools", () => {
  it("verifies required, first-round and forbidden tools", () => {
    const o = outcome("Raspuns.", ["get_client_diagnostic", "get_trends"]);
    expect(
      failedIds(o, {
        requiredTools: ["get_trends"],
        diagnosticFirst: true,
        forbiddenTools: ["list_clients"],
      })
    ).toHaveLength(0);

    const noDiag = outcome("Raspuns.", ["get_client_kpis"]);
    expect(failedIds(noDiag, { diagnosticFirst: true })).toContain("diagnostic_first");
    expect(failedIds(noDiag, { forbiddenTools: ["get_client_kpis"] })).toContain(
      "forbidden_tool:get_client_kpis"
    );
  });
});

describe("golden checks: content", () => {
  it("handles mustContain/mustNotContain with strings and regexes", () => {
    const o = outcome("Cash: -28.073 lei la iunie 2026.");
    expect(
      failedIds(o, { mustContain: [/28\.0\d\d/, "iunie 2026"], mustNotContain: ["CAEN"] })
    ).toHaveLength(0);
    expect(failedIds(o, { mustContain: ["Roche"] })).toContain('must_contain:"Roche"');
  });

  it("length cap is a warning, not a failure level", () => {
    const results = runChecks(outcome("x".repeat(2000)), { maxChars: 1000 });
    const cap = results.find((c) => c.id === "max_length");
    expect(cap?.ok).toBe(false);
    expect(cap?.level).toBe("warn");
  });
});
