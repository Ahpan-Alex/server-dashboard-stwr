import { config as loadDotenv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const here = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(here, "../../../.env") });
loadDotenv({ path: resolve(here, "../.env") });

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  SESSION_COOKIE_NAME: z.string().default("stwr_session"),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
  COOKIE_DOMAIN: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

export type Env = z.infer<typeof EnvSchema> & {
  COOKIE_SECURE: boolean;
  COOKIE_DOMAIN?: string;
};

let cached: Env | null = null;

export function loadEnv(overrides?: Partial<Record<string, string>>): Env {
  const raw = { ...process.env, ...overrides };
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment: ${msg}`);
  }
  const env = parsed.data as Env;
  if (env.COOKIE_SAMESITE === "none" && !env.COOKIE_SECURE) {
    throw new Error("COOKIE_SAMESITE=none requires COOKIE_SECURE=true (HTTPS).");
  }
  if (overrides) return env;
  cached = env;
  return env;
}

export function env(): Env {
  if (!cached) return loadEnv();
  return cached;
}
