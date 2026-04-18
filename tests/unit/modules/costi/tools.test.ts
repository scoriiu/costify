import { describe, it, expect } from "vitest";
import { COSTI_TOOLS } from "@/modules/costi/tools";

const TOOLS_WITHOUT_CLIENT = new Set(["list_clients", "get_account_catalog"]);

describe("Costi tool definitions", () => {
  it("defines 8 tools", () => {
    expect(COSTI_TOOLS).toHaveLength(8);
  });

  it("all tools have name, description, and input_schema", () => {
    for (const tool of COSTI_TOOLS) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.input_schema).toBeTruthy();
      expect(tool.input_schema.type).toBe("object");
    }
  });

  it("tools that need client_name require it", () => {
    const clientTools = COSTI_TOOLS.filter((t) => !TOOLS_WITHOUT_CLIENT.has(t.name));
    for (const tool of clientTools) {
      const required = (tool.input_schema as { required?: string[] }).required ?? [];
      expect(required).toContain("client_name");
    }
  });

  it("list_clients requires no parameters", () => {
    const listTool = COSTI_TOOLS.find((t) => t.name === "list_clients");
    expect(listTool).toBeDefined();
    const required = (listTool!.input_schema as { required?: string[] }).required ?? [];
    expect(required).toHaveLength(0);
  });

  it("get_journal_entries has a limit parameter", () => {
    const tool = COSTI_TOOLS.find((t) => t.name === "get_journal_entries");
    expect(tool).toBeDefined();
    const props = (tool!.input_schema as { properties: Record<string, unknown> }).properties;
    expect(props.limit).toBeDefined();
  });

  it("tool names are unique", () => {
    const names = COSTI_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("exposes the chart-of-accounts tools required for unmapped awareness", () => {
    const names = COSTI_TOOLS.map((t) => t.name);
    expect(names).toContain("get_unmapped_accounts");
    expect(names).toContain("get_account_catalog");
  });

  it("get_unmapped_accounts requires client_name, year, month", () => {
    const tool = COSTI_TOOLS.find((t) => t.name === "get_unmapped_accounts");
    expect(tool).toBeDefined();
    const required = (tool!.input_schema as { required?: string[] }).required ?? [];
    expect(required).toContain("client_name");
    expect(required).toContain("year");
    expect(required).toContain("month");
  });

  it("get_account_catalog takes no required params but exposes code, prefix, cpp_group", () => {
    const tool = COSTI_TOOLS.find((t) => t.name === "get_account_catalog");
    expect(tool).toBeDefined();
    const required = (tool!.input_schema as { required?: string[] }).required ?? [];
    expect(required).toHaveLength(0);
    const props = (tool!.input_schema as { properties: Record<string, unknown> }).properties;
    expect(props.code).toBeDefined();
    expect(props.prefix).toBeDefined();
    expect(props.cpp_group).toBeDefined();
  });

  it("get_unmapped_accounts description references UI warning and OMFP catalog", () => {
    const tool = COSTI_TOOLS.find((t) => t.name === "get_unmapped_accounts");
    expect(tool).toBeDefined();
    const desc = tool!.description!.toLowerCase();
    expect(desc).toContain("omfp");
    expect(desc).toContain("nemapat");
  });

  it("get_account_catalog description references OMFP 1802", () => {
    const tool = COSTI_TOOLS.find((t) => t.name === "get_account_catalog");
    expect(tool).toBeDefined();
    expect(tool!.description).toContain("OMFP 1802");
  });

  it("get_cpp exposes an optional 'mode' param with simplified / f20 enum (D17)", () => {
    const tool = COSTI_TOOLS.find((t) => t.name === "get_cpp");
    expect(tool).toBeDefined();

    const props = (tool!.input_schema as { properties: Record<string, { type?: string; enum?: string[] }> }).properties;
    expect(props.mode).toBeDefined();
    expect(props.mode.type).toBe("string");
    expect(props.mode.enum).toEqual(["simplified", "f20"]);

    // mode is NOT required — default is simplified.
    const required = (tool!.input_schema as { required?: string[] }).required ?? [];
    expect(required).not.toContain("mode");
  });

  it("get_cpp description references F20 detaliat mode", () => {
    const tool = COSTI_TOOLS.find((t) => t.name === "get_cpp");
    expect(tool).toBeDefined();
    expect(tool!.description.toLowerCase()).toContain("f20");
  });
});

describe("Costi tool handler dispatch", () => {
  it("every tool in COSTI_TOOLS has a corresponding case in handleToolCall", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const handlerSource = await fs.readFile(
      path.join(process.cwd(), "src/modules/costi/tool-handlers.ts"),
      "utf-8"
    );

    for (const tool of COSTI_TOOLS) {
      const casePattern = `case "${tool.name}":`;
      expect(
        handlerSource.includes(casePattern),
        `Missing handler case for tool "${tool.name}" — add "${casePattern}" to handleToolCall switch in tool-handlers.ts`
      ).toBe(true);
    }
  });
});
