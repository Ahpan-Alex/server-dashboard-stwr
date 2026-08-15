import type { FastifyInstance } from "fastify";
import {
  ChangePasswordBodySchema,
  ForgotPasswordBodySchema,
  LOCK_MINUTES,
  LoginBodySchema,
  MAX_LOGIN_ATTEMPTS,
  RESET_TOKEN_TTL_MS,
  ResetPasswordBodySchema,
  UpdateProfilePhotoBodySchema,
  type RoleId,
} from "@stwr/shared";
import { env } from "../config.js";
import { prisma } from "../db.js";
import { writeAudit } from "../lib/audit.js";
import {
  assertPasswordPolicy,
  generateOpaqueToken,
  hashPassword,
  hashToken,
  pushPasswordHistory,
  verifyPassword,
  wasPasswordReused,
} from "../lib/password.js";
import {
  clearSessionCookie,
  clientIp,
  createSession,
  loadAuthFromRequest,
  permissionsForRole,
  requireAuth,
  setSessionCookie,
  toPublicUser,
} from "../lib/session.js";

export async function authRoutes(app: FastifyInstance) {
  app.post(
    "/auth/login",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "15 minutes",
        },
      },
    },
    async (request, reply) => {
      const parsed = LoginBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Requête invalide." });
      }
      const email = parsed.data.email.trim().toLowerCase();
      const { password, deviceLabel } = parsed.data;
      const ip = clientIp(request);

      const user = await prisma.user.findFirst({
        where: { email },
        include: { tenant: true },
      });

      if (!user || !user.tenant) {
        return reply.code(401).send({ error: "Identifiants incorrects." });
      }

      if (!user.actif || !user.tenant.actif) {
        return reply.code(401).send({ error: "Compte désactivé." });
      }

      if (user.lockedUntil && user.lockedUntil > new Date()) {
        return reply.code(401).send({
          error: `Compte verrouillé jusqu'à ${user.lockedUntil.toLocaleString("fr-FR")}.`,
        });
      }

      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) {
        const failed = user.failedAttempts + 1;
        const locked =
          failed >= MAX_LOGIN_ATTEMPTS
            ? new Date(Date.now() + LOCK_MINUTES * 60_000)
            : null;
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedAttempts: failed,
            lockedUntil: locked,
          },
        });
        await writeAudit({
          tenantId: user.tenantId,
          userId: user.id,
          email: user.email,
          action: locked ? "lock" : "login_fail",
          detail: locked
            ? `Verrouillage après ${failed} échecs`
            : `Échec ${failed}/${MAX_LOGIN_ATTEMPTS}`,
          ipHint: ip,
        });
        return reply.code(401).send({
          error: locked
            ? `Trop de tentatives. Compte verrouillé ${LOCK_MINUTES} min.`
            : "Identifiants incorrects.",
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
        },
      });

      const { session, rawToken } = await createSession({
        userId: user.id,
        tenantId: user.tenantId,
        deviceLabel,
      });
      setSessionCookie(reply, rawToken);

      await writeAudit({
        tenantId: user.tenantId,
        userId: user.id,
        email: user.email,
        action: "login_ok",
        detail: `${user.role} · ${session.deviceLabel}`,
        ipHint: ip,
      });

      const role = user.role as RoleId;
      return {
        user: toPublicUser(user),
        tenant: {
          id: user.tenant.id,
          slug: user.tenant.slug,
          nom: user.tenant.nom,
          nif: user.tenant.nif,
          actif: user.tenant.actif,
        },
        permissions: permissionsForRole(role),
        session: {
          id: session.id,
          createdAt: session.createdAt.toISOString(),
          lastActivityAt: session.lastActivityAt.toISOString(),
          expiresAt: session.expiresAt.toISOString(),
          deviceLabel: session.deviceLabel,
        },
      };
    },
  );

  app.post("/auth/logout", async (request, reply) => {
    const auth = await loadAuthFromRequest(request);
    if (auth) {
      await prisma.session.update({
        where: { id: auth.session.id },
        data: { revokedAt: new Date() },
      });
      await writeAudit({
        tenantId: auth.tenant.id,
        userId: auth.user.id,
        email: auth.user.email,
        action: "logout",
        ipHint: clientIp(request),
      });
    }
    clearSessionCookie(reply);
    return { ok: true };
  });

  app.get("/auth/me", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    const role = auth.user.role as RoleId;
    return {
      user: toPublicUser(auth.user),
      tenant: {
        id: auth.tenant.id,
        slug: auth.tenant.slug,
        nom: auth.tenant.nom,
        nif: auth.tenant.nif,
        actif: auth.tenant.actif,
      },
      permissions: permissionsForRole(role),
      session: {
        id: auth.session.id,
        createdAt: auth.session.createdAt.toISOString(),
        lastActivityAt: auth.session.lastActivityAt.toISOString(),
        expiresAt: auth.session.expiresAt.toISOString(),
        deviceLabel: auth.session.deviceLabel,
      },
    };
  });

  app.patch("/auth/me/photo", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    const parsed = UpdateProfilePhotoBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error:
          "Photo invalide (JPEG/PNG/WebP en data URL, max ~300 Ko). Compressez l'image.",
      });
    }
    const updated = await prisma.user.update({
      where: { id: auth.user.id },
      data: { photoData: parsed.data.photoData },
    });
    await writeAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      email: auth.user.email,
      action: "user_update",
      detail: parsed.data.photoData ? "Photo de profil mise à jour" : "Photo de profil supprimée",
      ipHint: clientIp(request),
    });
    return { user: toPublicUser(updated) };
  });

  app.post("/auth/session/touch", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    const updated = await prisma.session.update({
      where: { id: auth.session.id },
      data: { lastActivityAt: new Date() },
    });
    return {
      session: {
        id: updated.id,
        lastActivityAt: updated.lastActivityAt.toISOString(),
        expiresAt: updated.expiresAt.toISOString(),
      },
    };
  });

  app.post("/auth/password/change", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    const parsed = ChangePasswordBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Requête invalide." });
    }
    const { currentPassword, newPassword } = parsed.data;
    const ok = await verifyPassword(currentPassword, auth.user.passwordHash);
    if (!ok) {
      return reply.code(400).send({ error: "Mot de passe actuel incorrect." });
    }
    const policyErr = assertPasswordPolicy(newPassword);
    if (policyErr) return reply.code(400).send({ error: policyErr });
    if (await wasPasswordReused(newPassword, auth.user.passwordHistory)) {
      return reply
        .code(400)
        .send({ error: "Réutilisation d'un mot de passe récent interdite." });
    }
    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: auth.user.id },
      data: {
        passwordHash: newHash,
        passwordHistory: pushPasswordHistory(auth.user.passwordHistory, newHash),
        mustChangePassword: false,
      },
    });
    await writeAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      email: auth.user.email,
      action: "password_change",
      ipHint: clientIp(request),
    });
    return { ok: true };
  });

  app.post("/auth/password/forgot", async (request, reply) => {
    const parsed = ForgotPasswordBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Requête invalide." });
    }
    const email = parsed.data.email.trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: { email, actif: true },
    });

    const response: { ok: true } = { ok: true };

    if (!user) {
      // Neutre — pas d'audit tenant fiable
      return response;
    }

    const raw = generateOpaqueToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    await writeAudit({
      tenantId: user.tenantId,
      userId: user.id,
      email: user.email,
      action: "password_reset_request",
      detail: "Lien généré (TTL 60 min)",
      ipHint: clientIp(request),
    });

    return response;
  });

  app.post("/auth/password/reset", async (request, reply) => {
    const parsed = ResetPasswordBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Requête invalide." });
    }
    const { token: tokenComposite, newPassword } = parsed.data;
    const dot = tokenComposite.indexOf(".");
    if (dot < 0) {
      return reply.code(400).send({ error: "Lien invalide." });
    }
    const tokenId = tokenComposite.slice(0, dot);
    const raw = tokenComposite.slice(dot + 1);
    if (!tokenId || !raw) {
      return reply.code(400).send({ error: "Lien invalide." });
    }

    const token = await prisma.passwordResetToken.findUnique({
      where: { id: tokenId },
      include: { user: true },
    });
    if (!token || token.usedAt || !token.user) {
      return reply.code(400).send({ error: "Lien invalide ou déjà utilisé." });
    }
    if (token.expiresAt < new Date()) {
      return reply.code(400).send({ error: "Lien expiré." });
    }
    if (hashToken(raw) !== token.tokenHash) {
      return reply.code(400).send({ error: "Lien invalide." });
    }

    const policyErr = assertPasswordPolicy(newPassword);
    if (policyErr) return reply.code(400).send({ error: policyErr });
    if (await wasPasswordReused(newPassword, token.user.passwordHistory)) {
      return reply
        .code(400)
        .send({ error: "Réutilisation d'un mot de passe récent interdite." });
    }

    const newHash = await hashPassword(newPassword);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: token.userId },
        data: {
          passwordHash: newHash,
          passwordHistory: pushPasswordHistory(
            token.user.passwordHistory,
            newHash,
          ),
          mustChangePassword: false,
          failedAttempts: 0,
          lockedUntil: null,
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      }),
      prisma.session.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await writeAudit({
      tenantId: token.user.tenantId,
      userId: token.userId,
      email: token.user.email,
      action: "password_reset_ok",
      detail: "Réinitialisation via lien",
      ipHint: clientIp(request),
    });

    return { ok: true };
  });
}
