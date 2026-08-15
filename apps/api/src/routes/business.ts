import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { roleHasPermission, type Permission, type RoleId } from "@stwr/shared";
import { prisma } from "../db.js";
import {
  emptyBusinessState,
  normalizeBusinessPayload,
} from "../lib/business-state.js";
import { requireAuth, requirePermission } from "../lib/session.js";

const WRITE_PERMISSIONS: Permission[] = [
  "parametres.gerer",
  "produits.gerer",
  "clients.gerer",
  "commercial.gerer",
  "charges.gerer",
  "factures.creer",
  "factures.modifier",
  "factures.encaisser",
];

function canWriteBusiness(role: RoleId) {
  return WRITE_PERMISSIONS.some((p) => roleHasPermission(role, p));
}

function asJson(data: unknown): Prisma.InputJsonValue {
  return data as Prisma.InputJsonValue;
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
    if (!canWriteBusiness(auth.user.role as RoleId)) {
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

  /** Remet l'état métier à vide (admin). */
  app.post("/business/reset", async (request, reply) => {
    const auth = await requirePermission(request, reply, "parametres.gerer");
    if (!auth) return;

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

    return {
      revision: updated.revision,
      updatedAt: updated.updatedAt.toISOString(),
      data: normalizeBusinessPayload(updated.data),
    };
  });
}
