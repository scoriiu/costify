import { describe, it, expect } from "vitest";
import { COSTI_TOOLS } from "@/modules/costi/tools";

describe("Costi tool definitions", () => {
  it("defines 6 tools", () => {
    expect(COSTI_TOOLS).toHaveLength(6);
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
    const clientTools = COSTI_TOOLS.filter((t) => t.name !== "list_clients");
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
});
