import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";

export const CATEGORIES_JOURNAL_AUDIT = [
  "suppression",
  "prix",
  "comptabilite",
  "rbac",
  "statut_critique",
] as const;

export const MODULES_JOURNAL_AUDIT = [
  "tiers",
  "produits",
  "commercial",
  "comptabilite",
  "rbac",
  "fabrication",
  "tresorerie",
] as const;

export const ACTIONS_JOURNAL_AUDIT = [
  "suppression_tiers",
  "suppression_produit",
  "suppression_commande",
  "suppression_ecriture",
  "suppression_compte_comptable",
  "modification_prix_vente",
  "remise_exceptionnelle",
  "modification_compte_charge",
  "modification_compte_vente",
  "modification_compte_comptable",
  "changement_role_utilisateur",
  "creation_utilisateur",
  "desactivation_utilisateur",
  "annulation_of_cloture",
  "rejet_cheque_differe",
  "deblocage_plafond_credit",
  "creation_lot_paiement",
  "annulation_lot_paiement",
] as const;

export type CategorieJournalAudit = (typeof CATEGORIES_JOURNAL_AUDIT)[number];
export type ModuleJournalAudit = (typeof MODULES_JOURNAL_AUDIT)[number];
export type ActionJournalAudit = (typeof ACTIONS_JOURNAL_AUDIT)[number];

export const CreateBusinessAuditSchema = z.object({
  categorie: z.enum(CATEGORIES_JOURNAL_AUDIT),
  action: z.enum(ACTIONS_JOURNAL_AUDIT),
  module: z.enum(MODULES_JOURNAL_AUDIT),
  objetType: z.string().trim().min(1).max(64),
  objetId: z.string().trim().max(128).optional(),
  objetLibelle: z.string().trim().max(255).optional(),
  objetHref: z.string().trim().max(255).optional(),
  champ: z.string().trim().max(128).optional(),
  ancienneValeur: z.string().max(8000).optional(),
  nouvelleValeur: z.string().max(8000).optional(),
  detail: z.string().trim().max(500).optional(),
  siteId: z.string().trim().max(64).optional(),
  siteLibelle: z.string().trim().max(200).optional(),
});

export type CreateBusinessAuditInput = z.infer<typeof CreateBusinessAuditSchema>;

export type AuditRetention = {
  suppressionsAnnees?: number | null;
  prixAnnees?: number | null;
  statutsCritiquesAnnees?: number | null;
};

const CATEGORIES_PURGEABLES: Record<
  "suppressionsAnnees" | "prixAnnees" | "statutsCritiquesAnnees",
  CategorieJournalAudit
> = {
  suppressionsAnnees: "suppression",
  prixAnnees: "prix",
  statutsCritiquesAnnees: "statut_critique",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function entierAnnees(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (value === undefined || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(50, Math.floor(n));
}

export function extraireRetentionAudit(data: unknown): AuditRetention {
  const params = asRecord(asRecord(data)?.parametres);
  const src = asRecord(params?.auditRetention) ?? {};
  return {
    suppressionsAnnees: entierAnnees(src.suppressionsAnnees),
    prixAnnees: entierAnnees(src.prixAnnees),
    statutsCritiquesAnnees: entierAnnees(src.statutsCritiquesAnnees),
  };
}

export async function writeBusinessAudit(input: {
  tenantId: string;
  userId?: string | null;
  userNom: string;
  payload: CreateBusinessAuditInput;
}) {
  return prisma.businessAudit.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      userNom: input.userNom.slice(0, 200) || "Utilisateur",
      categorie: input.payload.categorie,
      action: input.payload.action,
      module: input.payload.module,
      objetType: input.payload.objetType,
      objetId: input.payload.objetId || null,
      objetLibelle: input.payload.objetLibelle || null,
      objetHref: input.payload.objetHref || null,
      champ: input.payload.champ || null,
      ancienneValeur: input.payload.ancienneValeur || null,
      nouvelleValeur: input.payload.nouvelleValeur || null,
      detail: input.payload.detail || null,
      siteId: input.payload.siteId || null,
      siteLibelle: input.payload.siteLibelle || null,
    },
  });
}

/** Purge automatique : jamais rétroactive sur comptabilité / RBAC. */
export async function purgerJournalAuditExpire(
  tenantId: string,
  retention: AuditRetention,
) {
  const now = Date.now();
  const ops: Promise<unknown>[] = [];
  for (const [cle, categorie] of Object.entries(CATEGORIES_PURGEABLES) as [
    keyof typeof CATEGORIES_PURGEABLES,
    CategorieJournalAudit,
  ][]) {
    const annees = retention[cle];
    if (annees == null || annees <= 0) continue;
    const cutoff = new Date(now - annees * 365.25 * 24 * 60 * 60 * 1000);
    ops.push(
      prisma.businessAudit.deleteMany({
        where: {
          tenantId,
          categorie,
          createdAt: { lt: cutoff },
        },
      }),
    );
  }
  if (ops.length) await Promise.all(ops);
}

export function serialiserEntreeAudit(row: {
  id: string;
  createdAt: Date;
  userId: string | null;
  userNom: string;
  categorie: string;
  action: string;
  module: string;
  objetType: string;
  objetId: string | null;
  objetLibelle: string | null;
  objetHref: string | null;
  champ: string | null;
  ancienneValeur: string | null;
  nouvelleValeur: string | null;
  detail: string | null;
  siteId: string | null;
  siteLibelle: string | null;
}) {
  return {
    id: row.id,
    date: row.createdAt.toISOString(),
    userId: row.userId,
    userNom: row.userNom,
    categorie: row.categorie,
    action: row.action,
    module: row.module,
    objetType: row.objetType,
    objetId: row.objetId,
    objetLibelle: row.objetLibelle,
    objetHref: row.objetHref,
    champ: row.champ,
    ancienneValeur: row.ancienneValeur,
    nouvelleValeur: row.nouvelleValeur,
    detail: row.detail,
    siteId: row.siteId,
    siteLibelle: row.siteLibelle,
  };
}

export function filtreJournalAudit(query: {
  tenantId: string;
  userId?: string;
  categorie?: string;
  action?: string;
  module?: string;
  siteId?: string;
  objet?: string;
  debut?: string;
  fin?: string;
}): Prisma.BusinessAuditWhereInput {
  const where: Prisma.BusinessAuditWhereInput = { tenantId: query.tenantId };
  if (query.userId) where.userId = query.userId;
  if (query.categorie) where.categorie = query.categorie;
  if (query.action) where.action = query.action;
  if (query.module) where.module = query.module;
  if (query.siteId) where.siteId = query.siteId;
  if (query.debut || query.fin) {
    where.createdAt = {};
    if (query.debut) {
      const d = new Date(query.debut);
      if (!Number.isNaN(d.getTime())) where.createdAt.gte = d;
    }
    if (query.fin) {
      const d = new Date(query.fin);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        where.createdAt.lte = d;
      }
    }
  }
  const objet = query.objet?.trim();
  if (objet) {
    where.OR = [
      { objetId: { contains: objet } },
      { objetLibelle: { contains: objet } },
      { detail: { contains: objet } },
    ];
  }
  return where;
}
