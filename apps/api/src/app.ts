import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { env, loadEnv } from "./config.js";
import { prisma } from "./db.js";
import { authRoutes } from "./routes/auth.js";
import { adminRoutes } from "./routes/admin.js";
import { businessRoutes } from "./routes/business.js";

export async function buildApp(options?: { logger?: boolean }) {
  loadEnv();
  const e = env();

  const app = Fastify({
    logger: options?.logger ?? e.NODE_ENV !== "test",
    bodyLimit: 5 * 1024 * 1024,
    trustProxy: true,
  });

  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_req, body, done) => {
      if (!body) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(String(body)));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(cors, {
    origin: e.WEB_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });

  await app.register(cookie);

  await app.register(rateLimit, {
    global: false,
  });

  app.addHook("onRequest", async (request, reply) => {
    if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
      return;
    }
    const origin = request.headers.origin;
    if (origin && origin !== e.WEB_ORIGIN) {
      return reply.code(403).send({ error: "Origin refusée." });
    }
  });

  app.setErrorHandler((err, _request, reply) => {
    requestLogError(err);
    const status =
      err && typeof err === "object" && "statusCode" in err
        ? Number((err as { statusCode?: number }).statusCode) || 500
        : 500;
    const message =
      err instanceof Error ? err.message : "Erreur";
    if (status >= 500) {
      return reply.code(500).send({ error: "Erreur serveur." });
    }
    return reply.code(status).send({
      error: message || "Erreur",
    });
  });

  app.get("/health", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ok: true, db: true };
    } catch {
      return reply.code(503).send({ ok: false, db: false });
    }
  });

  await app.register(authRoutes);
  await app.register(adminRoutes);
  await app.register(businessRoutes);

  return app;
}

function requestLogError(err: unknown) {
  if (env().NODE_ENV === "test") return;
  console.error(err);
}
