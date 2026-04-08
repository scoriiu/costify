import { describe, it, expect } from "vitest";
import { paginate } from "@/shared/types";

describe("paginate", () => {
  it("builds paginated result with correct metadata", () => {
    const items = ["a", "b", "c"];
    const result = paginate(items, 10, { page: 1, limit: 3 });

    expect(result.items).toEqual(["a", "b", "c"]);
    expect(result.total).toBe(10);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(3);
    expect(result.hasNext).toBe(true);
  });

  it("hasNext is false when on last page", () => {
    const result = paginate(["x"], 3, { page: 3, limit: 1 });
    expect(result.hasNext).toBe(false);
  });

  it("hasNext is false when total fits in one page", () => {
    const result = paginate(["a", "b"], 2, { page: 1, limit: 10 });
    expect(result.hasNext).toBe(false);
  });

  it("handles empty items", () => {
    const result = paginate([], 0, { page: 1, limit: 10 });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.hasNext).toBe(false);
  });
});
