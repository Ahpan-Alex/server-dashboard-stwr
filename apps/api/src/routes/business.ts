import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import {
  ResetBusinessBodySchema,
  userHasPermission,
  type Permission,
} from "@stwr/shared";
import { prisma } from "../db.js";
import { writeAudit } from "../lib/audit.js";
import {
  CreateBusinessAuditSchema,
  extraireRetentionAudit,
  filtreJournalAudit,
  purgerJournalAuditExpire,
  serialiserEntreeAudit,
  writeBusinessAudit,
} from "../lib/business-audit.js";
import {
  emptyBusinessState,
  normalizeBusinessPayload,
  normaliserParametresAlertes,
} from "../lib/business-state.js";
import { verifyPassword } from "../lib/password.js";
import {
  clientIp,
  requireAuth,
  requirePermission,
} from "../lib/session.js";

const WRITE_PERMISSIONS: Permission[] = [
  "parametres.gerer",
  "produits.gerer",
  "clients.gerer",
  "commercial.gerer",
  "achats.gerer",
  "factures.creer",
  "factures.modifier",
  "factures.encaisser",
  "missions.gerer",
];

function canWriteBusiness(user: { role: string; roles?: unknown }) {
  return WRITE_PERMISSIONS.some((p) => userHasPermission(user, p));
}

function asJson(data: unknown): Prisma.InputJsonValue {
  return data as Prisma.InputJsonValue;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Ne remplace que la tranche de l'utilisateur courant — les autres restent intactes. */
function fusionnerPrefsAffichage(
  current: unknown,
  incoming: unknown,
  userId: string,
) {
  const cur = asRecord(current) ?? {};
  const inc = asRecord(incoming) ?? {};
  return {
    ...cur,
    [userId]: inc[userId] ?? cur[userId] ?? {},
  };
}

async function getOrCreateState(tenantId: string) {
  const existing = await prisma.businessState.findUnique({
    where: { tenantId },
  });
  if (existing) return existing;
  return prisma.businessState.create({
    data: {
      tenantId,
      revision: 1,
      data: asJson(emptyBusinessState()),
    },
  });
}

export async function businessRoutes(app: FastifyInstance) {
  app.get("/business", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const row = await getOrCreateState(auth.tenant.id);
    return {
      revision: row.revision,
      updatedAt: row.updatedAt.toISOString(),
      data: normalizeBusinessPayload(row.data),
    };
  });

  app.put("/business", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    if (!canWriteBusiness(auth.user)) {
      return reply.code(403).send({ error: "Permission insuffisante." });
    }

    const body = request.body as {
      data?: unknown;
      expectedRevision?: number;
    };
    if (!body || body.data === undefined) {
      return reply.code(400).send({ error: "Payload data manquant." });
    }

    const data = normalizeBusinessPayload(body.data);
    const current = await getOrCreateState(auth.tenant.id);
    const currentData = normalizeBusinessPayload(current.data);

    if (
      !userHasPermission(auth.user, "navigation.identite")
    ) {
      data.identiteNavigation = currentData.identiteNavigation;
    }

    if (!userHasPermission(auth.user, "parametres.gerer")) {
      data.parametresAlertes = currentData.parametresAlertes;
    }

    data.preferencesAffichage = fusionnerPrefsAffichage(
      currentData.preferencesAffichage,
      data.preferencesAffichage,
      auth.user.id,
    );

    data.alertesSuivi = fusionnerPrefsAffichage(
      currentData.alertesSuivi,
      data.alertesSuivi,
      auth.user.id,
    );

    if (
      typeof body.expectedRevision === "number" &&
      body.expectedRevision !== current.revision
    ) {
      return reply.code(409).send({
        error: "Conflit de révision — rechargez les données.",
        revision: current.revision,
        updatedAt: current.updatedAt.toISOString(),
        data: normalizeBusinessPayload(current.data),
      });
    }

    const updated = await prisma.businessState.update({
      where: { tenantId: auth.tenant.id },
      data: {
        data: asJson(data),
        revision: { increment: 1 },
      },
    });

    return {
      revision: updated.revision,
      updatedAt: updated.updatedAt.toISOString(),
      data: normalizeBusinessPayload(updated.data),
    };
  });

  /** Préférences d'affichage du compte courant — tout utilisateur authentifié. */
  app.put("/business/preferences-affichage", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const body = request.body as { prefs?: unknown };
    if (!body || typeof body.prefs !== "object" || body.prefs === null) {
      return reply.code(400).send({ error: "Préférences manquantes." });
    }

    const current = await getOrCreateState(auth.tenant.id);
    const currentData = normalizeBusinessPayload(current.data);
    const incoming = {
      preferencesAffichage: {
        ...(asRecord(currentData.preferencesAffichage) ?? {}),
        [auth.user.id]: body.prefs,
      },
    };
    currentData.preferencesAffichage = fusionnerPrefsAffichage(
      currentData.preferencesAffichage,
      incoming.preferencesAffichage,
      auth.user.id,
    );

    const updated = await prisma.businessState.update({
      where: { tenantId: auth.tenant.id },
      data: {
        data: asJson(currentData),
        revision: { increment: 1 },
      },
    });

    return {
      revision: updated.revision,
      updatedAt: updated.updatedAt.toISOString(),
      data: normalizeBusinessPayload(updated.data),
    };
  });

  /** Configuration des alertes — administrateur uniquement. */
  app.put("/business/parametres-alertes", async (request, reply) => {
    const auth = await requirePermission(request, reply, "parametres.gerer");
    if (!auth) return;

    const body = request.body as { parametresAlertes?: unknown };
    if (
      !body ||
      typeof body.parametresAlertes !== "object" ||
      body.parametresAlertes === null
    ) {
      return reply.code(400).send({ error: "Paramètres d'alertes manquants." });
    }

    const current = await getOrCreateState(auth.tenant.id);
    const currentData = normalizeBusinessPayload(current.data);
    currentData.parametresAlertes = normaliserParametresAlertes(
      body.parametresAlertes,
    );

    const updated = await prisma.businessState.update({
      where: { tenantId: auth.tenant.id },
      data: {
        data: asJson(currentData),
        revision: { increment: 1 },
      },
    });

    return {
      revision: updated.revision,
      updatedAt: updated.updatedAt.toISOString(),
      data: normalizeBusinessPayload(updated.data),
    };
  });

  /** Lu / traité des alertes — tout utilisateur authentifié (sa propre tranche). */
  app.put("/business/alertes-suivi", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const body = request.body as { suivi?: unknown };
    if (!body || typeof body.suivi !== "object" || body.suivi === null) {
      return reply.code(400).send({ error: "Suivi d'alertes manquant." });
    }

    const current = await getOrCreateState(auth.tenant.id);
    const currentData = normalizeBusinessPayload(current.data);
    const incoming = {
      alertesSuivi: {
        ...(asRecord(currentData.alertesSuivi) ?? {}),
        [auth.user.id]: body.suivi,
      },
    };
    currentData.alertesSuivi = fusionnerPrefsAffichage(
      currentData.alertesSuivi,
      incoming.alertesSuivi,
      auth.user.id,
    );

    const updated = await prisma.businessState.update({
      where: { tenantId: auth.tenant.id },
      data: {
        data: asJson(currentData),
        revision: { increment: 1 },
      },
    });

    return {
      revision: updated.revision,
      updatedAt: updated.updatedAt.toISOString(),
      data: normalizeBusinessPayload(updated.data),
    };
  });
  app.post(
    "/business/reset",
    {
      config: {
        rateLimit: {
          max: 8,
          timeWindow: "15 minutes",
        },
      },
    },
    async (request, reply) => {
      const auth = await requirePermission(request, reply, "parametres.gerer");
      if (!auth) return;

      const parsed = ResetBusinessBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Mot de passe requis." });
      }

      const ok = await verifyPassword(
        parsed.data.password,
        auth.user.passwordHash,
      );
      if (!ok) {
        await writeAudit({
          tenantId: auth.tenant.id,
          userId: auth.user.id,
          email: auth.user.email,
          action: "login_fail",
          detail: "Reset données — mot de passe incorrect",
          ipHint: clientIp(request),
        });
        return reply.code(401).send({ error: "Mot de passe incorrect." });
      }

      const payload = emptyBusinessState();

      const updated = await prisma.businessState.upsert({
        where: { tenantId: auth.tenant.id },
        create: {
          tenantId: auth.tenant.id,
          revision: 1,
          data: asJson(payload),
        },
        update: {
          data: asJson(payload),
          revision: { increment: 1 },
        },
      });

      await writeAudit({
        tenantId: auth.tenant.id,
        userId: auth.user.id,
        email: auth.user.email,
        action: "business_reset",
        detail: "Reset données métier",
        ipHint: clientIp(request),
      });

      return {
        revision: updated.revision,
        updatedAt: updated.updatedAt.toISOString(),
        data: normalizeBusinessPayload(updated.data),
      };
    },
  );

  app.post("/business/audit", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;
    if (!canWriteBusiness(auth.user)) {
      return reply.code(403).send({ error: "Permission insuffisante." });
    }
    const parsed = CreateBusinessAuditSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Entrée d'audit invalide." });
    }
    const row = await writeBusinessAudit({
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      userNom: auth.user.nom,
      payload: parsed.data,
    });
    return { ok: true, id: row.id };
  });

  app.get("/business/audit", async (request, reply) => {
    const auth = await requirePermission(request, reply, "audit.lire");
    if (!auth) return;
    const q = request.query as Record<string, string | undefined>;
    const state = await getOrCreateState(auth.tenant.id);
    await purgerJournalAuditExpire(
      auth.tenant.id,
      extraireRetentionAudit(state.data),
    );
    const where = filtreJournalAudit({
      tenantId: auth.tenant.id,
      userId: q.userId,
      categorie: q.categorie,
      action: q.action,
      module: q.module,
      siteId: q.siteId,
      objet: q.objet,
      debut: q.debut,
      fin: q.fin,
    });
    const page = Math.max(1, Number(q.page) || 1);
    const exportAll = q.export === "1" || q.export === "true";
    const pageSize = exportAll
      ? 5000
      : Math.min(100, Math.max(10, Number(q.pageSize) || 50));
    const [total, rows] = await Promise.all([
      prisma.businessAudit.count({ where }),
      prisma.businessAudit.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: exportAll ? 0 : (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      total,
      page,
      pageSize,
      items: rows.map(serialiserEntreeAudit),
    };
  });
}
