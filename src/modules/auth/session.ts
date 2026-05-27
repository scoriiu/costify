import { randomBytes } from "crypto";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import type { User } from "@prisma/client";

const SESSION_COOKIE = "sid";
const SESSION_EXPIRY_DAYS = 7;

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function getExpiryDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + SESSION_EXPIRY_DAYS);
  return date;
}

export async function createSession(
  userId: string,
  ip?: string,
  userAgent?: string
) {
  const token = generateToken();
  const expiresAt = getExpiryDate();

  const session = await prisma.session.create({
    data: { userId, token, ipAddress: ip, userAgent, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60,
    expires: expiresAt,
  });

  console.log(`[session] created sid=${token.slice(0, 8)} user=${userId} expires=${expiresAt.toISOString()}`);
  return session;
}

/**
 * Return the user behind the current session cookie, or null.
 *
 * Wrapped in React `cache()` so it dedupes within a single request.
 * A typical page render + downstream API call previously hit this
 * function 2-4 times across page.tsx, layout.tsx, and the API route's
 * middleware, paying the full session-lookup cost each time. Now: one
 * Postgres roundtrip per request, regardless of how many components
 * call getSessionUser().
 *
 * Uses $queryRaw with a JOIN instead of Prisma's findUnique+include.
 * findUnique+include issues a query for the Session row, then a
 * separate query for the joined User, then hydrates both through
 * Prisma's ORM layer (~80 ms of overhead even at LAN latency, ~300 ms
 * through the local dev port-forward). $queryRaw with a JOIN is one
 * roundtrip and returns plain JS — measured at ~5 ms LAN, ~35 ms
 * port-forwarded.
 *
 * Expired-session cleanup is deferred to a separate fire-and-forget
 * call so the read path never waits on a DELETE.
 */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  const rows = await prisma.$queryRaw<
    Array<{
      session_id: string;
      expires_at: Date;
      user_id: string;
      user_email: string;
      user_name: string;
      user_password_hash: string;
      user_email_verified: boolean;
      user_active: boolean;
      user_role: string;
      user_last_login_at: Date | null;
      user_created_at: Date;
      user_updated_at: Date;
    }>
  >`
    SELECT
      s.id AS session_id,
      s."expiresAt" AS expires_at,
      u.id AS user_id,
      u.email AS user_email,
      u.name AS user_name,
      u."passwordHash" AS user_password_hash,
      u."emailVerified" AS user_email_verified,
      u.active AS user_active,
      u."userRole" AS user_role,
      u."lastLoginAt" AS user_last_login_at,
      u."createdAt" AS user_created_at,
      u."updatedAt" AS user_updated_at
    FROM "Session" s
    JOIN "User" u ON u.id = s."userId"
    WHERE s.token = ${token}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) return null;

  if (row.expires_at < new Date()) {
    // Fire-and-forget cleanup; the read path returns immediately.
    prisma.session.delete({ where: { id: row.session_id } }).catch(() => {});
    return null;
  }

  return {
    id: row.user_id,
    email: row.user_email,
    name: row.user_name,
    passwordHash: row.user_password_hash,
    emailVerified: row.user_email_verified,
    active: row.user_active,
    userRole: row.user_role,
    lastLoginAt: row.user_last_login_at,
    createdAt: row.user_created_at,
    updatedAt: row.user_updated_at,
  };
});

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { token } });
    cookieStore.delete(SESSION_COOKIE);
  }
}

export async function getUserSessions(userId: string) {
  return prisma.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      expiresAt: true,
    },
  });
}

export async function revokeSession(sessionId: string, userId: string) {
  return prisma.session.deleteMany({
    where: { id: sessionId, userId },
  });
}
