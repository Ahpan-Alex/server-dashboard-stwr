import argon2 from "argon2";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  PASSWORD_HISTORY_SIZE,
  validatePassword,
} from "@stwr/shared";

const ARGON_OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON_OPTS);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function assertPasswordPolicy(password: string): string | null {
  const errs = validatePassword(password);
  return errs.length ? errs.join(" · ") : null;
}

export async function wasPasswordReused(
  password: string,
  history: unknown,
): Promise<boolean> {
  const list = Array.isArray(history)
    ? history.filter((h): h is string => typeof h === "string")
    : [];
  for (const prev of list) {
    if (await verifyPassword(password, prev)) return true;
  }
  return false;
}

export function pushPasswordHistory(
  history: unknown,
  newHash: string,
): string[] {
  const list = Array.isArray(history)
    ? history.filter((h): h is string => typeof h === "string")
    : [];
  return [newHash, ...list].slice(0, PASSWORD_HISTORY_SIZE);
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
