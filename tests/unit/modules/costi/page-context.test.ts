import { describe, it, expect, afterEach } from "vitest";
import { parsePage } from "@/modules/costi/page-context";
import { buildSystemPrompt } from "@/modules/costi/prompt";

afterEach(() => {
  delete process.env.COSTI_CFO_MODE;
});

describe("parsePage", () => {
  it("extracts the client slug from a client page", () => {
    expect(parsePage("/clients/qhm21-network-srl")).toEqual({
      clientSlug: "qhm21-network-srl",
      ownerView: false,
    });
  });

  it("detects the owner view flag", () => {
    expect(parsePage("/clients/qhm21-network-srl?view=owner")).toEqual({
      clientSlug: "qhm21-network-srl",
      ownerView: true,
    });
  });

  it("keeps the slug with other query params and sub-paths", () => {
    expect(parsePage("/clients/acme-srl?tab=cpp&view=owner").clientSlug).toBe("acme-srl");
    expect(parsePage("/clients/acme-srl/import?x=1").clientSlug).toBe("acme-srl");
  });

  it("returns null slug on non-client pages", () => {
    expect(parsePage("/costi").clientSlug).toBeNull();
    expect(parsePage("/clients").clientSlug).toBeNull();
    expect(parsePage("/docs/costi-cfo-playbooks").clientSlug).toBeNull();
    expect(parsePage("").clientSlug).toBeNull();
    expect(parsePage(undefined).clientSlug).toBeNull();
  });

  it("ignores view=owner outside client pages", () => {
    const parsed = parsePage("/firma?view=owner");
    expect(parsed.clientSlug).toBeNull();
  });
});

describe("buildSystemPrompt page-context section", () => {
  const ctx = {
    clientName: "QHM21 NETWORK SRL",
    clientSlug: "qhm21-network-srl",
    ownerView: false,
  };

  const SECTION = "CONTEXT PAGINA (locul din aplicatie";

  it("is absent without context (both modes)", () => {
    expect(buildSystemPrompt("test", false, null)).not.toContain(SECTION);
    expect(buildSystemPrompt("test", true, null)).not.toContain(SECTION);
  });

  it("names the selected client and forbids list_clients guessing", () => {
    const prompt = buildSystemPrompt("test", true, ctx);
    expect(prompt).toContain(SECTION);
    expect(prompt).toContain("QHM21 NETWORK SRL");
    expect(prompt).toContain('client_name: "QHM21 NETWORK SRL"');
    expect(prompt).toContain("NU apela list_clients");
  });

  it("activates the patron voice on owner view", () => {
    const prompt = buildSystemPrompt("test", true, { ...ctx, ownerView: true });
    expect(prompt).toContain("Vederea PATRON e activa");
    expect(prompt).toContain("fara jargon contabil");
  });

  it("declares the contabil voice otherwise", () => {
    const prompt = buildSystemPrompt("test", true, ctx);
    expect(prompt).toContain("Vederea CONTABIL e activa");
    expect(prompt).not.toContain("Vederea PATRON e activa");
  });

  it("works in legacy mode too (context is independent of the CFO flag)", () => {
    const prompt = buildSystemPrompt("test", false, ctx);
    expect(prompt).toContain(SECTION);
    expect(prompt).toContain("QHM21 NETWORK SRL");
    expect(prompt).not.toContain("MOD CFO");
  });
});
