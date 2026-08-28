import { z } from "zod";

export const RoleIdSchema = z.enum([
  "admin_entreprise",
  "comptable",
  "commercial",
  "caissier",
  "lecture_seule",
]);

export type RoleId = z.infer<typeof RoleIdSchema>;

export const PermissionSchema = z.enum([
  "factures.lire",
  "factures.creer",
  "factures.modifier",
  "factures.valider",
  "factures.avoir",
  "factures.encaisser",
  "produits.lire",
  "produits.gerer",
  "clients.lire",
  "clients.gerer",
  "commercial.lire",
  "commercial.gerer",
  "charges.lire",
  "charges.gerer",
  "rentabilite.lire",
  "parametres.lire",
  "parametres.gerer",
  "navigation.identite",
  "users.gerer",
  "audit.lire",
  "securite.gerer",
]);

export type Permission = z.infer<typeof PermissionSchema>;

export const ROLE_LABELS: Record<RoleId, string> = {
  admin_entreprise: "Administrateur entreprise",
  comptable: "Comptable",
  commercial: "Commercial",
  caissier: "Caissier",
  lecture_seule: "Lecture seule",
};

export const ROLE_PERMISSIONS: Record<RoleId, Permission[]> = {
  admin_entreprise: [
    "factures.lire",
    "factures.creer",
    "factures.modifier",
    "factures.valider",
    "factures.avoir",
    "factures.encaisser",
    "produits.lire",
    "produits.gerer",
    "clients.lire",
    "clients.gerer",
    "commercial.lire",
    "commercial.gerer",
    "charges.lire",
    "charges.gerer",
    "rentabilite.lire",
    "parametres.lire",
    "parametres.gerer",
    "navigation.identite",
    "users.gerer",
    "audit.lire",
    "securite.gerer",
  ],
  comptable: [
    "factures.lire",
    "factures.creer",
    "factures.modifier",
    "factures.valider",
    "factures.avoir",
    "factures.encaisser",
    "produits.lire",
    "produits.gerer",
    "clients.lire",
    "clients.gerer",
    "commercial.lire",
    "charges.lire",
    "charges.gerer",
    "rentabilite.lire",
    "parametres.lire",
    "audit.lire",
  ],
  commercial: [
    "factures.lire",
    "factures.creer",
    "factures.modifier",
    "factures.valider",
    "produits.lire",
    "clients.lire",
    "clients.gerer",
    "commercial.lire",
    "commercial.gerer",
    "rentabilite.lire",
  ],
  caissier: [
    "factures.lire",
    "factures.creer",
    "factures.encaisser",
    "produits.lire",
    "clients.lire",
    "commercial.lire",
  ],
  lecture_seule: [
    "factures.lire",
    "produits.lire",
    "clients.lire",
    "commercial.lire",
    "charges.lire",
    "rentabilite.lire",
    "parametres.lire",
    "audit.lire",
  ],
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  "factures.lire": "Factures — lecture",
  "factures.creer": "Factures — création",
  "factures.modifier": "Factures — modification",
  "factures.valider": "Factures — validation fiscale",
  "factures.avoir": "Factures — avoirs",
  "factures.encaisser": "Factures — encaissement",
  "produits.lire": "Produits — lecture",
  "produits.gerer": "Produits — gestion",
  "clients.lire": "Clients — lecture",
  "clients.gerer": "Clients — gestion",
  "commercial.lire": "Commercial — lecture",
  "commercial.gerer": "Commercial — gestion",
  "charges.lire": "Charges — lecture",
  "charges.gerer": "Charges — gestion",
  "rentabilite.lire": "Rentabilité — lecture",
  "parametres.lire": "Paramètres — lecture",
  "parametres.gerer": "Paramètres — gestion",
  "navigation.identite": "Menu — identité (nom et logo)",
  "users.gerer": "Utilisateurs — gestion",
  "audit.lire": "Journal d'audit — lecture",
  "securite.gerer": "Sécurité — gestion",
};

export function roleHasPermission(role: RoleId, permission: Permission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;
export const SESSION_IDLE_MS = 60 * 60 * 1000;
export const SESSION_MAX_MS = 14 * 24 * 60 * 60 * 1000;
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
export const PASSWORD_HISTORY_SIZE = 5;
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

const FORBIDDEN_SUBSTRINGS = [
  "password",
  "motdepasse",
  "123456",
  "stwr",
  "admin",
];

export function validatePassword(password: string): string[] {
  const errs: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    errs.push("Au moins 12 caractères");
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    errs.push("Maximum 128 caractères");
  }
  const lower = password.toLowerCase();
  if (FORBIDDEN_SUBSTRINGS.some((w) => lower.includes(w))) {
    errs.push("Mot de passe trop courant / prévisible");
  }
  return errs;
}

export const AuthAuditActionSchema = z.enum([
  "login_ok",
  "login_fail",
  "logout",
  "lock",
  "unlock",
  "password_reset_request",
  "password_reset_ok",
  "password_change",
  "user_create",
  "user_update",
  "user_deactivate",
  "session_revoke",
  "business_reset",
]);

export type AuthAuditAction = z.infer<typeof AuthAuditActionSchema>;

export const LoginBodySchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  deviceLabel: z.string().max(64).optional(),
});

export const ChangePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
});

export const ForgotPasswordBodySchema = z.object({
  email: z.string().email().max(255),
});

export const ResetPasswordBodySchema = z.object({
  token: z.string().min(1).max(2048),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
});

export const ResetBusinessBodySchema = z.object({
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export const CreateUserBodySchema = z.object({
  email: z.string().email().max(255),
  nom: z.string().min(1).max(200),
  role: RoleIdSchema,
  pointDeVenteIds: z.array(z.string().max(64)).default([]),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  mfaRequired: z.boolean().optional(),
});

export const UpdateUserBodySchema = z
  .object({
    nom: z.string().min(1).max(200).optional(),
    role: RoleIdSchema.optional(),
    pointDeVenteIds: z.array(z.string().max(64)).optional(),
    actif: z.boolean().optional(),
    mfaRequired: z.boolean().optional(),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH)
      .max(PASSWORD_MAX_LENGTH)
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Aucun champ à mettre à jour",
  });

/** Photo profil : data URL image, ou null pour supprimer. Max ~300 Ko encodés. */
export const UpdateProfilePhotoBodySchema = z.object({
  photoData: z
    .string()
    .max(400_000)
    .regex(/^data:image\/(jpeg|jpg|png|webp);base64,/i)
    .nullable(),
});
