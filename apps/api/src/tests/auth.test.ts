import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { buildApp } from "../app.js";
import { loadEnv } from "../config.js";

const prisma = new PrismaClient();
const TEST_PASSWORD = "TestPass2026!STWR";

function cookieFrom(res: { headers: Record<string, unknown> }) {
  const set = res.headers["set-cookie"];
  if (!set) return "";
  const raw = Array.isArray(set) ? set[0] : String(set);
  return raw.split(";")[0] ?? "";
}

describe("auth + tenant isolation", () => {
  let app: FastifyInstance;
  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    loadEnv({
      NODE_ENV: "test",
      DATABASE_URL:
        process.env.DATABASE_URL ?? "mysql://stwr:stwr@localhost:3306/stwr",
      WEB_ORIGIN: "http://localhost:3000",
      SESSION_COOKIE_NAME: "stwr_session",
      COOKIE_SECURE: "false",
      COOKIE_SAMESITE: "lax",
      PORT: "3001",
    });

    app = await buildApp({ logger: false });
    await app.ready();

    await prisma.passwordResetToken.deleteMany({
      where: { user: { tenant: { slug: { startsWith: "stwr-test-" } } } },
    });
    await prisma.authAudit.deleteMany({
      where: { tenant: { slug: { startsWith: "stwr-test-" } } },
    });
    await prisma.session.deleteMany({
      where: { tenant: { slug: { startsWith: "stwr-test-" } } },
    });
    await prisma.user.deleteMany({
      where: { tenant: { slug: { startsWith: "stwr-test-" } } },
    });
    await prisma.tenant.deleteMany({
      where: { slug: { startsWith: "stwr-test-" } },
    });

    const tA = await prisma.tenant.create({
      data: { slug: "stwr-test-a", nom: "Tenant A", actif: true },
    });
    const tB = await prisma.tenant.create({
      data: { slug: "stwr-test-b", nom: "Tenant B", actif: true },
    });
    tenantAId = tA.id;
    tenantBId = tB.id;

    const hash = await argon2.hash(TEST_PASSWORD, { type: argon2.argon2id });
    await prisma.user.createMany({
      data: [
        {
          tenantId: tenantAId,
          email: "admin@a.test",
          nom: "Admin A",
          role: "admin_entreprise",
          passwordHash: hash,
          passwordHistory: [hash],
        },
        {
          tenantId: tenantAId,
          email: "caisse@a.test",
          nom: "Caisse A",
          role: "caissier",
          passwordHash: hash,
          passwordHistory: [hash],
        },
        {
          tenantId: tenantBId,
          email: "admin@b.test",
          nom: "Admin B",
          role: "admin_entreprise",
          passwordHash: hash,
          passwordHistory: [hash],
        },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("sans cookie → GET /auth/me 401", async () => {
    const res = await app.inject({ method: "GET", url: "/auth/me" });
    expect(res.statusCode).toBe(401);
  });

  it("login OK + cookie → GET /auth/me", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { origin: "http://localhost:3000" },
      payload: { email: "admin@a.test", password: TEST_PASSWORD },
    });
    expect(login.statusCode).toBe(200);
    const cookie = cookieFrom(login);
    expect(cookie).toContain("stwr_session=");

    const me = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { cookie },
    });
    expect(me.statusCode).toBe(200);
    const body = me.json();
    expect(body.user.email).toBe("admin@a.test");
    expect(body.tenant.id).toBe(tenantAId);
    expect(body.permissions).toContain("users.gerer");
  });

  it("isolation tenant: admin A ne voit pas users de B", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { origin: "http://localhost:3000" },
      payload: { email: "admin@a.test", password: TEST_PASSWORD },
    });
    const cookie = cookieFrom(login);
    const users = await app.inject({
      method: "GET",
      url: "/users",
      headers: { cookie },
    });
    expect(users.statusCode).toBe(200);
    const emails = users.json().users.map((u: { email: string }) => u.email);
    expect(emails).toContain("admin@a.test");
    expect(emails).toContain("caisse@a.test");
    expect(emails).not.toContain("admin@b.test");
  });

  it("caissier POST /users → 403", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { origin: "http://localhost:3000" },
      payload: { email: "caisse@a.test", password: TEST_PASSWORD },
    });
    const cookie = cookieFrom(login);
    const res = await app.inject({
      method: "POST",
      url: "/users",
      headers: { cookie, origin: "http://localhost:3000" },
      payload: {
        email: "nouveau@a.test",
        nom: "Nouveau",
        role: "lecture_seule",
        password: "MotDePasseValide99!",
        pointDeVenteIds: [],
      },
    });
    expect(res.statusCode).toBe(403);
  });
});
