import nodemailer from "nodemailer";
import { z } from "zod";
export type EnvoiDocumentsSecrets = {
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFrom?: string;
  whatsappToken?: string;
  whatsappPhoneNumberId?: string;
};

export const EnvoiConfigBodySchema = z.object({
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  smtpFrom: z.string().optional(),
  whatsappToken: z.string().optional(),
  whatsappPhoneNumberId: z.string().optional(),
});

export const EnvoiDocumentBodySchema = z.object({
  canal: z.enum(["email", "whatsapp"]),
  destinataire: z.string().min(3).max(200),
  sujet: z.string().max(200).optional(),
  message: z.string().max(4000).optional(),
  filename: z.string().min(1).max(180),
  pdfBase64: z.string().min(80).max(12_000_000),
  typeDocument: z.string().max(64).optional(),
  numero: z.string().max(80).optional(),
});

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function extraireEnvoiDocuments(raw: unknown): EnvoiDocumentsSecrets {
  const root = asRecord(raw);
  const src = asRecord(root?.envoiDocuments);
  if (!src) return {};
  const port = Number(src.smtpPort);
  return {
    smtpHost: str(src.smtpHost),
    smtpPort: Number.isFinite(port) && port > 0 ? Math.floor(port) : undefined,
    smtpSecure: typeof src.smtpSecure === "boolean" ? src.smtpSecure : undefined,
    smtpUser: str(src.smtpUser),
    smtpPassword: str(src.smtpPassword),
    smtpFrom: str(src.smtpFrom),
    whatsappToken: str(src.whatsappToken),
    whatsappPhoneNumberId: str(src.whatsappPhoneNumberId),
  };
}

export function fusionnerEnvoiDocuments(
  current: EnvoiDocumentsSecrets,
  patch: z.infer<typeof EnvoiConfigBodySchema>,
): EnvoiDocumentsSecrets {
  const next: EnvoiDocumentsSecrets = { ...current };
  if (patch.smtpHost !== undefined) next.smtpHost = patch.smtpHost.trim() || undefined;
  if (patch.smtpPort !== undefined) next.smtpPort = patch.smtpPort;
  if (patch.smtpSecure !== undefined) next.smtpSecure = patch.smtpSecure;
  if (patch.smtpUser !== undefined) next.smtpUser = patch.smtpUser.trim() || undefined;
  if (patch.smtpFrom !== undefined) next.smtpFrom = patch.smtpFrom.trim() || undefined;
  if (patch.smtpPassword !== undefined && patch.smtpPassword.trim()) {
    next.smtpPassword = patch.smtpPassword.trim();
  }
  if (patch.whatsappPhoneNumberId !== undefined) {
    next.whatsappPhoneNumberId = patch.whatsappPhoneNumberId.trim() || undefined;
  }
  if (patch.whatsappToken !== undefined && patch.whatsappToken.trim()) {
    next.whatsappToken = patch.whatsappToken.trim();
  }
  return next;
}

function secretsDepuisEnv(): EnvoiDocumentsSecrets {
  const raw = process.env;
  const port = Number(raw.SMTP_PORT);
  return {
    smtpHost: str(raw.SMTP_HOST),
    smtpPort: Number.isFinite(port) && port > 0 ? Math.floor(port) : undefined,
    smtpSecure: raw.SMTP_SECURE === "true" || raw.SMTP_SECURE === "1",
    smtpUser: str(raw.SMTP_USER),
    smtpPassword: str(raw.SMTP_PASSWORD),
    smtpFrom: str(raw.SMTP_FROM),
    whatsappToken: str(raw.WHATSAPP_TOKEN),
    whatsappPhoneNumberId: str(raw.WHATSAPP_PHONE_NUMBER_ID),
  };
}

export function resoudreEnvoiDocuments(
  tenant: EnvoiDocumentsSecrets,
): EnvoiDocumentsSecrets {
  const fromEnv = secretsDepuisEnv();
  return {
    smtpHost: tenant.smtpHost || fromEnv.smtpHost,
    smtpPort: tenant.smtpPort ?? fromEnv.smtpPort,
    smtpSecure: tenant.smtpSecure ?? fromEnv.smtpSecure,
    smtpUser: tenant.smtpUser || fromEnv.smtpUser,
    smtpPassword: tenant.smtpPassword || fromEnv.smtpPassword,
    smtpFrom: tenant.smtpFrom || fromEnv.smtpFrom || tenant.smtpUser || fromEnv.smtpUser,
    whatsappToken: tenant.whatsappToken || fromEnv.whatsappToken,
    whatsappPhoneNumberId:
      tenant.whatsappPhoneNumberId || fromEnv.whatsappPhoneNumberId,
  };
}

export function statutEnvoiDocuments(tenant: EnvoiDocumentsSecrets) {
  const s = resoudreEnvoiDocuments(tenant);
  return {
    emailPret: Boolean(s.smtpHost && s.smtpFrom),
    whatsappPret: Boolean(s.whatsappToken && s.whatsappPhoneNumberId),
    smtpHost: s.smtpHost ?? "",
    smtpPort: s.smtpPort ?? 587,
    smtpSecure: Boolean(s.smtpSecure),
    smtpUser: s.smtpUser ?? "",
    smtpFrom: s.smtpFrom ?? "",
    whatsappPhoneNumberId: s.whatsappPhoneNumberId ?? "",
    motDePasseSmtpRenseigne: Boolean(s.smtpPassword),
    jetonWhatsappRenseigne: Boolean(s.whatsappToken),
  };
}

export function normaliserTelephoneWhatsapp(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("261") && digits.length >= 11) return digits;
  if (digits.startsWith("0") && digits.length >= 9) return `261${digits.slice(1)}`;
  if (digits.length === 9) return `261${digits}`;
  if (digits.length >= 10) return digits;
  return null;
}

function pdfBuffer(base64: string): Buffer {
  const cleaned = base64.replace(/^data:application\/pdf;base64,/i, "");
  return Buffer.from(cleaned, "base64");
}

export async function envoyerParEmail(opts: {
  secrets: EnvoiDocumentsSecrets;
  destinataire: string;
  sujet: string;
  message: string;
  filename: string;
  pdf: Buffer;
}) {
  const s = resoudreEnvoiDocuments(opts.secrets);
  if (!s.smtpHost || !s.smtpFrom) {
    return {
      ok: false as const,
      reason:
        "L'envoi e-mail n'est pas configuré. Paramètres → Documents → Envoi.",
    };
  }
  const transporter = nodemailer.createTransport({
    host: s.smtpHost,
    port: s.smtpPort ?? (s.smtpSecure ? 465 : 587),
    secure: Boolean(s.smtpSecure),
    auth:
      s.smtpUser && s.smtpPassword
        ? { user: s.smtpUser, pass: s.smtpPassword }
        : undefined,
  });
  await transporter.sendMail({
    from: s.smtpFrom,
    to: opts.destinataire,
    subject: opts.sujet,
    text: opts.message,
    attachments: [
      {
        filename: opts.filename.endsWith(".pdf")
          ? opts.filename
          : `${opts.filename}.pdf`,
        content: opts.pdf,
        contentType: "application/pdf",
      },
    ],
  });
  return { ok: true as const };
}

export async function envoyerParWhatsapp(opts: {
  secrets: EnvoiDocumentsSecrets;
  destinataire: string;
  message: string;
  filename: string;
  pdf: Buffer;
}) {
  const s = resoudreEnvoiDocuments(opts.secrets);
  if (!s.whatsappToken || !s.whatsappPhoneNumberId) {
    return {
      ok: false as const,
      reason:
        "L'envoi WhatsApp n'est pas configuré. Paramètres → Documents → Envoi.",
    };
  }
  const to = normaliserTelephoneWhatsapp(opts.destinataire);
  if (!to) {
    return { ok: false as const, reason: "Numéro WhatsApp invalide." };
  }
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", "application/pdf");
  form.append(
    "file",
    new Blob([new Uint8Array(opts.pdf)], { type: "application/pdf" }),
    opts.filename.endsWith(".pdf") ? opts.filename : `${opts.filename}.pdf`,
  );
  const mediaRes = await fetch(
    `https://graph.facebook.com/v21.0/${s.whatsappPhoneNumberId}/media`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${s.whatsappToken}` },
      body: form,
    },
  );
  const mediaJson = (await mediaRes.json()) as { id?: string; error?: { message?: string } };
  if (!mediaRes.ok || !mediaJson.id) {
    return {
      ok: false as const,
      reason:
        mediaJson.error?.message ||
        "Échec du dépôt du PDF sur WhatsApp (vérifiez le jeton Meta).",
    };
  }
  const sendRes = await fetch(
    `https://graph.facebook.com/v21.0/${s.whatsappPhoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${s.whatsappToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "document",
        document: {
          id: mediaJson.id,
          filename: opts.filename.endsWith(".pdf")
            ? opts.filename
            : `${opts.filename}.pdf`,
          caption: opts.message || undefined,
        },
      }),
    },
  );
  const sendJson = (await sendRes.json()) as { error?: { message?: string } };
  if (!sendRes.ok) {
    return {
      ok: false as const,
      reason: sendJson.error?.message || "Échec de l'envoi WhatsApp.",
    };
  }
  return { ok: true as const };
}

export async function envoyerDocumentPdf(
  secrets: EnvoiDocumentsSecrets,
  body: z.infer<typeof EnvoiDocumentBodySchema>,
) {
  const pdf = pdfBuffer(body.pdfBase64);
  if (pdf.length < 40) {
    return { ok: false as const, reason: "PDF vide." };
  }
  const filename = body.filename.replace(/[\\/:*?"<>|]+/g, "-").trim() || "document.pdf";
  const message = (body.message ?? "").trim() || `Veuillez trouver ci-joint ${filename}.`;
  if (body.canal === "email") {
    const dest = body.destinataire.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dest)) {
      return { ok: false as const, reason: "Adresse e-mail invalide." };
    }
    return envoyerParEmail({
      secrets,
      destinataire: dest,
      sujet: (body.sujet ?? "").trim() || filename,
      message,
      filename,
      pdf,
    });
  }
  return envoyerParWhatsapp({
    secrets,
    destinataire: body.destinataire,
    message,
    filename,
    pdf,
  });
}
