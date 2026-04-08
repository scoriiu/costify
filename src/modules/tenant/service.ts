import { prisma } from "@/lib/db";
import { uniqueSlug } from "@/lib/slug";
import type { Result } from "@/shared/errors";
import { ok, err, notFound, validation } from "@/shared/errors";
import type { Tenant, CreateTenantInput, TenantWithStats } from "./types";

export async function createTenant(
  userId: string,
  input: CreateTenantInput
): Promise<Result<Tenant>> {
  if (input.name.length < 2) {
    return err(validation("Name must be at least 2 characters"));
  }

  const slug = await uniqueSlug(input.name, async (s) => {
    const existing = await prisma.client.findUnique({
      where: { userId_slug: { userId, slug: s } },
    });
    return !!existing;
  });

  const client = await prisma.client.create({
    data: {
      name: input.name,
      slug,
      cui: input.cui ?? null,
      caen: input.caen ?? null,
      userId,
    },
  });

  return ok(toTenant(client));
}

export async function getTenantBySlug(
  userId: string,
  slug: string
): Promise<Result<Tenant>> {
  const client = await prisma.client.findFirst({
    where: { userId, slug, active: true },
  });

  if (!client) return err(notFound("Client", slug));
  return ok(toTenant(client));
}

export async function getTenantById(
  userId: string,
  tenantId: string
): Promise<Result<Tenant>> {
  const client = await prisma.client.findFirst({
    where: { id: tenantId, userId, active: true },
  });

  if (!client) return err(notFound("Client", tenantId));
  return ok(toTenant(client));
}

export async function listTenants(userId: string): Promise<TenantWithStats[]> {
  const clients = await prisma.client.findMany({
    where: { userId, active: true },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { journalLines: { where: { deletedAt: null } } } } },
  });

  return clients.map((c) => ({
    ...toTenant(c),
    datasetCount: c._count.journalLines,
  }));
}

export async function verifyTenantAccess(
  userId: string,
  tenantId: string
): Promise<boolean> {
  const client = await prisma.client.findFirst({
    where: { id: tenantId, userId, active: true },
    select: { id: true },
  });
  return !!client;
}

function toTenant(client: {
  id: string;
  userId: string;
  name: string;
  slug: string;
  cui: string | null;
  caen: string | null;
  active: boolean;
  createdAt: Date;
}): Tenant {
  return {
    id: client.id,
    userId: client.userId,
    name: client.name,
    slug: client.slug,
    cui: client.cui,
    caen: client.caen,
    active: client.active,
    createdAt: client.createdAt,
  };
}
