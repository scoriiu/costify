import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

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

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    console.log(`[session] no cookie present`);
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) {
    console.log(`[session] token ${token.slice(0, 8)} not found in DB`);
    return null;
  }

  if (session.expiresAt < new Date()) {
    console.log(`[session] token ${token.slice(0, 8)} expired at ${session.expiresAt.toISOString()}`);
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return session.user;
}

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
