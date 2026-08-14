import type { FastifyInstance } from "fastify";
import {
  CreateUserBodySchema,
  PERMISSION_LABELS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  RoleIdSchema,
  UpdateUserBodySchema,
  type RoleId,
  roleHasPermission,
} from "@stwr/shared";
import { prisma } from "../db.js";
import { writeAudit } from "../lib/audit.js";
import {
  assertPasswordPolicy,
  hashPassword,
  pushPasswordHistory,
} from "../lib/password.js";
import {
  clientIp,
  normalizeRole,
  requireAuth,
  requirePermission,
  toPublicUser,
} from "../lib/session.js";

export async function adminRoutes(app: FastifyInstance) {
  app.get("/users", async (request, reply) => {
    const auth = await requirePermission(request, reply, "users.gerer");
    if (!auth) return;
    const users = await prisma.user.findMany({
      where: { tenantId: auth.tenant.id },
      orderBy: { createdAt: "desc" },
    });
    return { users: users.map(toPublicUser) };
  });

  app.post("/users", async (request, reply) => {
    const auth = await requirePermission(request, reply, "users.gerer");
    if (!auth) return;
    const parsed = CreateUserBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Requête invalide." });
    }
    const data = parsed.data;
    const email = data.email.trim().toLowerCase();
    const policyErr = assertPasswordPolicy(data.password);
    if (policyErr) return reply.code(400).send({ error: policyErr });

    const existing = await prisma.user.findFirst({
      where: { tenantId: auth.tenant.id, email },
    });
    if (existing) {
      return reply.code(409).send({ error: "Cet e-mail existe déjà." });
    }

    const passwordHash = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: {
        tenantId: auth.tenant.id,
        email,
        nom: data.nom.trim(),
        role: data.role,
        pointDeVenteIds: data.pointDeVenteIds,
        passwordHash,
        passwordHistory: [passwordHash],
        mfaRequired: data.mfaRequired ?? false,
        mustChangePassword: true,
      },
    });

    await writeAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      email: auth.user.email,
      action: "user_create",
      detail: `${email} · ${ROLE_LABELS[data.role]}`,
      ipHint: clientIp(request),
    });

    return reply.code(201).send({ user: toPublicUser(user) });
  });

  app.patch("/users/:id", async (request, reply) => {
    const auth = await requirePermission(request, reply, "users.gerer");
    if (!auth) return;
    const { id } = request.params as { id: string };
    const parsed = UpdateUserBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Requête invalide." });
    }

    const target = await prisma.user.findFirst({
      where: { id, tenantId: auth.tenant.id },
    });
    if (!target) {
      return reply.code(404).send({ error: "Utilisateur introuvable." });
    }

    const data = parsed.data;
    if (data.role) {
      const roleCheck = RoleIdSchema.safeParse(data.role);
      if (!roleCheck.success) {
        return reply.code(400).send({ error: "Rôle invalide." });
      }
    }

    let passwordHash: string | undefined;
    let passwordHistory: string[] | undefined;
    let mustChangePassword = target.mustChangePassword;
    if (data.password) {
      const policyErr = assertPasswordPolicy(data.password);
      if (policyErr) return reply.code(400).send({ error: policyErr });
      passwordHash = await hashPassword(data.password);
      passwordHistory = pushPasswordHistory(target.passwordHistory, passwordHash);
      mustChangePassword = true;
      await prisma.session.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    const user = await prisma.user.update({
      where: { id: target.id },
      data: {
        ...(data.nom !== undefined ? { nom: data.nom.trim() } : {}),
        ...(data.role !== undefined ? { role: data.role } : {}),
        ...(data.pointDeVenteIds !== undefined
          ? { pointDeVenteIds: data.pointDeVenteIds }
          : {}),
        ...(data.actif !== undefined ? { actif: data.actif } : {}),
        ...(data.mfaRequired !== undefined
          ? { mfaRequired: data.mfaRequired }
          : {}),
        ...(passwordHash && passwordHistory
          ? {
              passwordHash,
              passwordHistory,
              mustChangePassword,
              failedAttempts: 0,
              lockedUntil: null,
            }
          : {}),
      },
    });

    await writeAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      email: auth.user.email,
      action: data.actif === false ? "user_deactivate" : "user_update",
      detail: passwordHash ? `Admin reset · ${id}` : id,
      ipHint: clientIp(request),
    });
    if (passwordHash) {
      await writeAudit({
        tenantId: auth.tenant.id,
        userId: auth.user.id,
        email: auth.user.email,
        action: "password_reset_ok",
        detail: `Admin reset · ${id}`,
        ipHint: clientIp(request),
      });
    }

    return { user: toPublicUser(user) };
  });

  app.get("/admin/roles", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    // Lecture matrice : users.gerer OU lecture admin
    const role = auth.user.role as RoleId;
    if (
      !roleHasPermission(role, "users.gerer") &&
      !roleHasPermission(role, "audit.lire")
    ) {
      return reply.code(403).send({ error: "Permission refusée." });
    }
    return {
      roles: ROLE_LABELS,
      permissions: PERMISSION_LABELS,
      matrix: ROLE_PERMISSIONS,
    };
  });

  app.get("/admin/audit", async (request, reply) => {
    const auth = await requirePermission(request, reply, "audit.lire");
    if (!auth) return;
    const query = request.query as {
      limit?: string;
      olderThanDays?: string;
      email?: string;
    };
    const limit = Math.min(Number(query.limit) || 100, 5000);
    const olderThanDays = Number(query.olderThanDays);
    const email = query.email?.trim().toLowerCase();
    const where: {
      tenantId: string;
      createdAt?: { lt: Date };
      email?: { contains: string };
    } = { tenantId: auth.tenant.id };
    if (Number.isFinite(olderThanDays) && olderThanDays > 0) {
      where.createdAt = {
        lt: new Date(Date.now() - olderThanDays * 86_400_000),
      };
    }
    if (email) where.email = { contains: email };

    const entries = await prisma.authAudit.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return {
      audit: entries.map((e) => ({
        id: e.id,
        date: e.createdAt.toISOString(),
        tenantId: e.tenantId,
        userId: e.userId,
        email: e.email,
        action: e.action,
        detail: e.detail,
        ipHint: e.ipHint,
      })),
    };
  });

  app.delete("/admin/audit", async (request, reply) => {
    const auth = await requirePermission(request, reply, "audit.lire");
    if (!auth) return;
    const role = normalizeRole(auth.user.role);
    const canPurge =
      roleHasPermission(role, "parametres.gerer") ||
      roleHasPermission(role, "securite.gerer") ||
      roleHasPermission(role, "users.gerer");
    if (!canPurge) {
      return reply.code(403).send({ error: "Permission refusée." });
    }

    const body = (request.body ?? {}) as { olderThanDays?: number };
    const olderThanDays = Number(body.olderThanDays) || 90;
    if (olderThanDays < 1) {
      return reply.code(400).send({ error: "Seuil de purge invalide." });
    }
    const before = new Date(Date.now() - olderThanDays * 86_400_000);
    const result = await prisma.authAudit.deleteMany({
      where: {
        tenantId: auth.tenant.id,
        createdAt: { lt: before },
      },
    });

    await writeAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      email: auth.user.email,
      action: "user_update",
      detail: `Purge audit > ${olderThanDays}j · ${result.count} événement(s)`,
      ipHint: clientIp(request),
    });

    return { ok: true, deleted: result.count, olderThanDays };
  });

  app.get("/admin/sessions", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    const canManage = roleHasPermission(
      auth.user.role as RoleId,
      "securite.gerer",
    );
    const sessions = await prisma.session.findMany({
      where: {
        tenantId: auth.tenant.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        ...(canManage ? {} : { userId: auth.user.id }),
      },
      include: { user: { select: { id: true, email: true, nom: true } } },
      orderBy: { lastActivityAt: "desc" },
      take: 100,
    });
    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        userId: s.userId,
        tenantId: s.tenantId,
        createdAt: s.createdAt.toISOString(),
        lastActivityAt: s.lastActivityAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        deviceLabel: s.deviceLabel,
        userEmail: s.user.email,
        userNom: s.user.nom,
        isCurrent: s.id === auth.session.id,
      })),
      canManage,
    };
  });

  app.delete("/admin/sessions/:id", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    const { id } = request.params as { id: string };
    const session = await prisma.session.findFirst({
      where: { id, tenantId: auth.tenant.id, revokedAt: null },
    });
    if (!session) {
      return reply.code(404).send({ error: "Session introuvable." });
    }
    const canManage = roleHasPermission(
      auth.user.role as RoleId,
      "securite.gerer",
    );
    if (session.userId !== auth.user.id && !canManage) {
      return reply.code(403).send({ error: "Permission refusée." });
    }

    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    await writeAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      email: auth.user.email,
      action: "session_revoke",
      detail: id,
      ipHint: clientIp(request),
    });

    if (session.id === auth.session.id) {
      const { clearSessionCookie } = await import("../lib/session.js");
      clearSessionCookie(reply);
    }
    return { ok: true };
  });
}
