import { config as loadDotenv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { emptyBusinessState } from "../src/lib/business-state.js";

const here = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(here, "../.env") });
loadDotenv({ path: resolve(here, "../../../.env") });

const prisma = new PrismaClient();
const DEMO_PASSWORD = "Demo2026!STWR";

const ARGON_OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

async function upsertUser(input: {
  tenantId: string;
  email: string;
  nom: string;
  role: string;
  pointDeVenteIds?: string[];
}) {
  const passwordHash = await argon2.hash(DEMO_PASSWORD, ARGON_OPTS);
  const existing = await prisma.user.findFirst({
    where: { tenantId: input.tenantId, email: input.email },
  });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        nom: input.nom,
        role: input.role,
        pointDeVenteIds: input.pointDeVenteIds ?? [],
        actif: true,
      },
    });
  }
  return prisma.user.create({
    data: {
      tenantId: input.tenantId,
      email: input.email,
      nom: input.nom,
      role: input.role,
      pointDeVenteIds: input.pointDeVenteIds ?? [],
      passwordHash,
      passwordHistory: [passwordHash],
      actif: true,
      mfaRequired: false,
    },
  });
}

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "stwr" },
    update: {
      nom: "STWR Poissonnerie",
      nif: "5000123456",
      actif: true,
    },
    create: {
      slug: "stwr",
      nom: "STWR Poissonnerie",
      nif: "5000123456",
      actif: true,
    },
  });

  const other = await prisma.tenant.upsert({
    where: { slug: "autre" },
    update: { nom: "Autre Entreprise", actif: true },
    create: {
      slug: "autre",
      nom: "Autre Entreprise",
      actif: true,
    },
  });

  await upsertUser({
    tenantId: tenant.id,
    email: "admin@stwr.mg",
    nom: "Admin STWR",
    role: "admin_entreprise",
  });
  await upsertUser({
    tenantId: tenant.id,
    email: "comptable@stwr.mg",
    nom: "Comptable STWR",
    role: "comptable",
  });
  await upsertUser({
    tenantId: tenant.id,
    email: "caisse@stwr.mg",
    nom: "Caissier Marché",
    role: "caissier",
    pointDeVenteIds: ["pdv-marche"],
  });
  await upsertUser({
    tenantId: tenant.id,
    email: "lecture@stwr.mg",
    nom: "Consultation direction",
    role: "lecture_seule",
  });

  // État métier vide uniquement à la création — ne jamais écraser la prod au boot.
  const empty = emptyBusinessState();
  const existingStwr = await prisma.businessState.findUnique({
    where: { tenantId: tenant.id },
  });
  if (!existingStwr) {
    await prisma.businessState.create({
      data: {
        tenantId: tenant.id,
        revision: 1,
        data: empty,
      },
    });
  }

  const existingOther = await prisma.businessState.findUnique({
    where: { tenantId: other.id },
  });
  if (!existingOther) {
    await prisma.businessState.create({
      data: {
        tenantId: other.id,
        revision: 1,
        data: empty,
      },
    });
  }

  console.log("Seed OK — tenant stwr + 4 users + business state VIDE (Demo2026!STWR)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
