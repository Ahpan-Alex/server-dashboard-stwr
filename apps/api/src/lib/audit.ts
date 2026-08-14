import type { AuthAuditAction } from "@stwr/shared";
import { prisma } from "../db.js";

export async function writeAudit(input: {
  tenantId: string;
  userId?: string | null;
  email?: string | null;
  action: AuthAuditAction;
  detail?: string;
  ipHint?: string | null;
}) {
  await prisma.authAudit.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      email: input.email ?? null,
      action: input.action,
      detail: input.detail ?? null,
      ipHint: input.ipHint ?? null,
    },
  });
}
