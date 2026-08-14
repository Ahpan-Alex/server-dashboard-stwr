import type { FastifyReply, FastifyRequest } from "fastify";
import {
  ROLE_PERMISSIONS,
  SESSION_IDLE_MS,
  SESSION_MAX_MS,
  type Permission,
  type RoleId,
  roleHasPermission,
} from "@stwr/shared";
import { env } from "../config.js";
import { prisma } from "../db.js";
import { generateOpaqueToken, hashToken } from "./password.js";
import type { Session, Tenant, User } from "@prisma/client";

export type PublicUser = {
  id: string;
  tenantId: string;
  email: string;
  nom: string;
  role: RoleId;
  pointDeVenteIds: string[];
  actif: boolean;
  mfaRequired: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  /** Data URL de la photo de profil, si définie. */
  photoData: string | null;
};

export type AuthContext = {
  session: Session;
  user: User;
  tenant: Tenant;
  rawToken: string;
};

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

export function toPublicUser(user: User): PublicUser {
  const pdv = Array.isArray(user.pointDeVenteIds)
    ? (user.pointDeVenteIds as string[])
    : [];
  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    nom: user.nom,
    role: normalizeRole(user.role),
    pointDeVenteIds: pdv,
    actif: user.actif,
    mfaRequired: user.mfaRequired,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    photoData: user.photoData ?? null,
  };
}

export function normalizeRole(role: string): RoleId {
  if (role === "admin") return "admin_entreprise";
  return role as RoleId;
}

export function permissionsForRole(role: RoleId | string): Permission[] {
  return ROLE_PERMISSIONS[normalizeRole(role)] ?? [];
}

export function setSessionCookie(reply: FastifyReply, rawToken: string) {
  const e = env();
  reply.setCookie(e.SESSION_COOKIE_NAME, rawToken, {
    path: "/",
    httpOnly: true,
    secure: e.COOKIE_SECURE,
    sameSite: e.COOKIE_SAMESITE,
    ...(e.COOKIE_DOMAIN ? { domain: e.COOKIE_DOMAIN } : {}),
    maxAge: Math.floor(SESSION_MAX_MS / 1000),
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  const e = env();
  reply.clearCookie(e.SESSION_COOKIE_NAME, {
    path: "/",
    httpOnly: true,
    secure: e.COOKIE_SECURE,
    sameSite: e.COOKIE_SAMESITE,
    ...(e.COOKIE_DOMAIN ? { domain: e.COOKIE_DOMAIN } : {}),
  });
}

export async function createSession(input: {
  userId: string;
  tenantId: string;
  deviceLabel?: string;
}): Promise<{ session: Session; rawToken: string }> {
  const rawToken = generateOpaqueToken();
  const now = new Date();
  const session = await prisma.session.create({
    data: {
      userId: input.userId,
      tenantId: input.tenantId,
      tokenHash: hashToken(rawToken),
      createdAt: now,
      lastActivityAt: now,
      expiresAt: new Date(now.getTime() + SESSION_MAX_MS),
      deviceLabel: input.deviceLabel?.slice(0, 64) || "Navigateur",
    },
  });
  return { session, rawToken };
}

export function isSessionTimedOut(session: Session, now = Date.now()): boolean {
  if (session.revokedAt) return true;
  if (now > session.expiresAt.getTime()) return true;
  if (now - session.lastActivityAt.getTime() > SESSION_IDLE_MS) return true;
  return false;
}

export async function loadAuthFromRequest(
  request: FastifyRequest,
): Promise<AuthContext | null> {
  const rawToken = request.cookies[env().SESSION_COOKIE_NAME];
  if (!rawToken) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: true, tenant: true },
  });
  if (!session || !session.user || !session.tenant) return null;
  if (isSessionTimedOut(session)) return null;
  if (!session.user.actif || !session.tenant.actif) return null;

  return {
    session,
    user: session.user,
    tenant: session.tenant,
    rawToken,
  };
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<AuthContext | null> {
  const auth = await loadAuthFromRequest(request);
  if (!auth) {
    reply.code(401).send({ error: "Non authentifié." });
    return null;
  }
  request.auth = auth;
  return auth;
}

export async function requirePermission(
  request: FastifyRequest,
  reply: FastifyReply,
  permission: Permission,
): Promise<AuthContext | null> {
  const auth = await requireAuth(request, reply);
  if (!auth) return null;
  if (!roleHasPermission(normalizeRole(auth.user.role), permission)) {
    reply.code(403).send({ error: "Permission refusée." });
    return null;
  }
  return auth;
}

export function clientIp(request: FastifyRequest): string | null {
  const xf = request.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0]?.trim() ?? null;
  return request.ip || null;
}
