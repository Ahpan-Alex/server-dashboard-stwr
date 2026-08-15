import { config as loadDotenv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { emptyBusinessState } from "../src/lib/business-state.js";

const here = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(here, "../../../.env") });
loadDotenv({ path: resolve(here, "../.env") });

const prisma = new PrismaClient();

const ARGON_OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

const DEMO_EMAILS = [
  "admin@stwr.mg",
  "comptable@stwr.mg",
  "caisse@stwr.mg",
  "lecture@stwr.mg",
];

async function removeDemoUsers(keepEmail?: string) {
  const emails = DEMO_EMAILS.filter(
    (e) => e !== keepEmail?.trim().toLowerCase(),
  );
  const demoUsers = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const ids = demoUsers.map((u) => u.id);
  if (!ids.length) return;
  await prisma.passwordResetToken.deleteMany({ where: { userId: { in: ids } } });
  await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  await prisma.authAudit.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

async function ensureAdmin(tenantId: string) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD?.trim();
  const nom = process.env.ADMIN_NOM?.trim() || "Administrateur";
  if (!email || !password) {
    throw new Error(
      "ADMIN_EMAIL et ADMIN_PASSWORD sont requis pour le seed (plus de comptes démo).",
    );
  }

  const passwordHash = await argon2.hash(password, ARGON_OPTS);
  const existing = await prisma.user.findFirst({
    where: { tenantId, email },
  });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        nom,
        role: "admin_entreprise",
        actif: true,
      },
    });
  }
  return prisma.user.create({
    data: {
      tenantId,
      email,
      nom,
      role: "admin_entreprise",
      pointDeVenteIds: [],
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
      actif: true,
    },
    create: {
      slug: "stwr",
      nom: "STWR Poissonnerie",
      actif: true,
    },
  });

  await removeDemoUsers(process.env.ADMIN_EMAIL);
  await ensureAdmin(tenant.id);

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

  const other = await prisma.tenant.findUnique({ where: { slug: "autre" } });
  if (other) {
    await prisma.passwordResetToken.deleteMany({
      where: { user: { tenantId: other.id } },
    });
    await prisma.session.deleteMany({ where: { tenantId: other.id } });
    await prisma.authAudit.deleteMany({ where: { tenantId: other.id } });
    await prisma.businessState.deleteMany({ where: { tenantId: other.id } });
    await prisma.user.deleteMany({ where: { tenantId: other.id } });
    await prisma.tenant.delete({ where: { id: other.id } });
  }

  console.log(
    `Seed OK — tenant stwr + admin ${process.env.ADMIN_EMAIL?.trim().toLowerCase()} (comptes démo supprimés)`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
