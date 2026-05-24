import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  listOverridesForClient,
  listOverridesForCont,
  upsertOverride,
  confirmOverride,
  deleteOverride,
  bulkApplyOverrides,
} from "@/modules/partner-mappings";

/**
 * Build a minimal mock of the prisma client surface we use. Returning `any`
 * so TS doesn't complain about partial PrismaClient — these tests verify
 * call patterns, not full-DB behaviour (integration tests handle that).
 */
function makePrismaMock(rows: ReturnType<typeof makeRow>[] = []) {
  return {
    partnerCategoryOverride: {
      findMany: vi.fn().mockResolvedValue(rows),
      upsert: vi.fn().mockImplementation((args) => ({
        id: "new-id",
        clientId: args.create.clientId,
        contBase: args.create.contBase,
        partnerNameNormalized: args.create.partnerNameNormalized,
        partnerNameOriginal: args.create.partnerNameOriginal,
        categoryId: args.create.categoryId,
        source: args.create.source,
        confirmedAt: args.create.confirmedAt,
        createdAt: new Date("2026-04-01"),
        updatedAt: new Date("2026-04-01"),
      })),
      update: vi.fn().mockImplementation(() => makeRow({ source: "manual" })),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as PrismaClient;
}

function makeRow(overrides: Partial<ReturnType<typeof baseRow>> = {}) {
  return { ...baseRow(), ...overrides };
}

function baseRow() {
  return {
    id: "override-1",
    clientId: "client-1",
    contBase: "6022",
    partnerNameNormalized: "omv",
    partnerNameOriginal: "OMV PETROM SRL",
    categoryId: "cat-combustibil",
    source: "manual" as "manual" | "bulk" | "suggested",
    confirmedAt: new Date("2026-04-15"),
    createdAt: new Date("2026-04-01"),
    updatedAt: new Date("2026-04-15"),
  };
}

describe("partner-mappings/service", () => {
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = makePrismaMock();
  });

  /* -------------------- listOverridesForClient -------------------- */

  describe("listOverridesForClient", () => {
    it("queries by clientId, orders by contBase then partner name", async () => {
      prisma = makePrismaMock([
        makeRow({ contBase: "6022", partnerNameNormalized: "omv" }),
        makeRow({ id: "override-2", contBase: "6022", partnerNameNormalized: "petrom",
                  partnerNameOriginal: "PETROM" }),
      ]);

      const rows = await listOverridesForClient(prisma, "client-1");

      expect(rows).toHaveLength(2);
      expect(prisma.partnerCategoryOverride.findMany).toHaveBeenCalledWith({
        where: { clientId: "client-1" },
        orderBy: [{ contBase: "asc" }, { partnerNameNormalized: "asc" }],
      });
    });

    it("returns empty array when client has no overrides", async () => {
      const rows = await listOverridesForClient(prisma, "client-1");
      expect(rows).toEqual([]);
    });

    it("normalizes the source field to the typed union", async () => {
      prisma = makePrismaMock([makeRow({ source: "suggested" as const })]);
      const rows = await listOverridesForClient(prisma, "client-1");
      expect(rows[0].source).toBe("suggested");
    });
  });

  /* -------------------- listOverridesForCont -------------------- */

  describe("listOverridesForCont", () => {
    it("queries with both clientId and contBase as the filter", async () => {
      await listOverridesForCont(prisma, "client-1", "6022");
      expect(prisma.partnerCategoryOverride.findMany).toHaveBeenCalledWith({
        where: { clientId: "client-1", contBase: "6022" },
        orderBy: { partnerNameNormalized: "asc" },
      });
    });
  });

  /* -------------------- upsertOverride -------------------- */

  describe("upsertOverride", () => {
    it("sets confirmedAt to a Date when source is 'manual'", async () => {
      await upsertOverride(prisma, {
        clientId: "client-1",
        contBase: "6022",
        partnerNameNormalized: "sc logistic",
        partnerNameOriginal: "SC Logistic SRL",
        categoryId: "cat-curierat",
        source: "manual",
      });

      const call = (prisma.partnerCategoryOverride.upsert as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      expect(call.create.confirmedAt).toBeInstanceOf(Date);
      expect(call.update.confirmedAt).toBeInstanceOf(Date);
    });

    it("sets confirmedAt to a Date when source is 'bulk'", async () => {
      await upsertOverride(prisma, {
        clientId: "client-1",
        contBase: "6022",
        partnerNameNormalized: "omv",
        partnerNameOriginal: "OMV",
        categoryId: "cat-combustibil",
        source: "bulk",
      });

      const call = (prisma.partnerCategoryOverride.upsert as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      expect(call.create.confirmedAt).toBeInstanceOf(Date);
    });

    it("leaves confirmedAt null when source is 'suggested'", async () => {
      await upsertOverride(prisma, {
        clientId: "client-1",
        contBase: "6022",
        partnerNameNormalized: "omv",
        partnerNameOriginal: "OMV",
        categoryId: "cat-combustibil",
        source: "suggested",
      });

      const call = (prisma.partnerCategoryOverride.upsert as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      expect(call.create.confirmedAt).toBeNull();
    });

    it("respects explicit confirmedAt override regardless of source", async () => {
      const explicit = new Date("2025-12-31");
      await upsertOverride(prisma, {
        clientId: "client-1",
        contBase: "6022",
        partnerNameNormalized: "omv",
        partnerNameOriginal: "OMV",
        categoryId: "cat-combustibil",
        source: "suggested",
        confirmedAt: explicit,
      });

      const call = (prisma.partnerCategoryOverride.upsert as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      expect(call.create.confirmedAt).toBe(explicit);
    });

    it("uses the composite unique key for the where clause", async () => {
      await upsertOverride(prisma, {
        clientId: "client-1",
        contBase: "6022",
        partnerNameNormalized: "omv",
        partnerNameOriginal: "OMV",
        categoryId: "cat-combustibil",
        source: "manual",
      });

      const call = (prisma.partnerCategoryOverride.upsert as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      expect(call.where).toEqual({
        clientId_contBase_partnerNameNormalized: {
          clientId: "client-1",
          contBase: "6022",
          partnerNameNormalized: "omv",
        },
      });
    });

    it("updates partnerNameOriginal on existing rows (latest spelling wins)", async () => {
      await upsertOverride(prisma, {
        clientId: "client-1",
        contBase: "6022",
        partnerNameNormalized: "omv",
        partnerNameOriginal: "OMV PETROM MARKETING SRL", // new spelling
        categoryId: "cat-combustibil",
        source: "manual",
      });

      const call = (prisma.partnerCategoryOverride.upsert as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      expect(call.update.partnerNameOriginal).toBe("OMV PETROM MARKETING SRL");
    });
  });

  /* -------------------- confirmOverride -------------------- */

  describe("confirmOverride", () => {
    it("sets confirmedAt and flips source to 'manual'", async () => {
      await confirmOverride(prisma, "override-1");
      const call = (prisma.partnerCategoryOverride.update as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      expect(call.where).toEqual({ id: "override-1" });
      expect(call.data.source).toBe("manual");
      expect(call.data.confirmedAt).toBeInstanceOf(Date);
    });
  });

  /* -------------------- deleteOverride -------------------- */

  describe("deleteOverride", () => {
    it("calls prisma.delete with the id", async () => {
      await deleteOverride(prisma, "override-1");
      expect(prisma.partnerCategoryOverride.delete).toHaveBeenCalledWith({
        where: { id: "override-1" },
      });
    });
  });

  /* -------------------- bulkApplyOverrides -------------------- */

  describe("bulkApplyOverrides", () => {
    it("skips partners that already have overrides by default", async () => {
      prisma = makePrismaMock();
      (prisma.partnerCategoryOverride.findMany as ReturnType<typeof vi.fn>)
        .mockResolvedValue([{ partnerNameNormalized: "omv" }]);

      const result = await bulkApplyOverrides(prisma, {
        clientId: "client-1",
        contBase: "6022",
        categoryId: "cat-combustibil",
        source: "bulk",
        partners: [
          { nameNormalized: "omv", nameOriginal: "OMV" }, // already exists, skip
          { nameNormalized: "petrom", nameOriginal: "PETROM" },
          { nameNormalized: "mol", nameOriginal: "MOL" },
        ],
      });

      expect(result.applied).toBe(2);
      expect(result.skipped).toBe(1);
      expect(prisma.partnerCategoryOverride.upsert).toHaveBeenCalledTimes(2);
    });

    it("can overwrite existing when skipExistingOverrides=false", async () => {
      prisma = makePrismaMock();
      (prisma.partnerCategoryOverride.findMany as ReturnType<typeof vi.fn>)
        .mockResolvedValue([{ partnerNameNormalized: "omv" }]);

      const result = await bulkApplyOverrides(prisma, {
        clientId: "client-1",
        contBase: "6022",
        categoryId: "cat-combustibil",
        source: "bulk",
        partners: [
          { nameNormalized: "omv", nameOriginal: "OMV" },
          { nameNormalized: "petrom", nameOriginal: "PETROM" },
        ],
        skipExistingOverrides: false,
      });

      expect(result.applied).toBe(2);
      expect(result.skipped).toBe(0);
      expect(prisma.partnerCategoryOverride.upsert).toHaveBeenCalledTimes(2);
    });

    it("returns applied=0, skipped=0 for an empty partners list", async () => {
      const result = await bulkApplyOverrides(prisma, {
        clientId: "client-1",
        contBase: "6022",
        categoryId: "cat-combustibil",
        source: "bulk",
        partners: [],
      });

      expect(result).toEqual({ applied: 0, skipped: 0 });
      expect(prisma.partnerCategoryOverride.upsert).not.toHaveBeenCalled();
    });

    it("propagates source to each upsert (suggested keeps confirmedAt null)", async () => {
      await bulkApplyOverrides(prisma, {
        clientId: "client-1",
        contBase: "6022",
        categoryId: "cat-combustibil",
        source: "suggested",
        partners: [{ nameNormalized: "omv", nameOriginal: "OMV" }],
      });

      const call = (prisma.partnerCategoryOverride.upsert as ReturnType<typeof vi.fn>)
        .mock.calls[0][0];
      expect(call.create.source).toBe("suggested");
      expect(call.create.confirmedAt).toBeNull();
    });
  });
});
