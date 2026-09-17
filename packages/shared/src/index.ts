import { z } from "zod";

export const RoleIdSchema = z.enum([
  "admin_entreprise",
  "comptable",
  "acheteur",
  "caissier",
  "facturier",
  "vendeur",
  "lecture_seule",
]);

export type RoleId = z.infer<typeof RoleIdSchema>;

export type OperationalRole = "acheteur" | "caissier" | "facturier" | "vendeur";

export const OPERATIONAL_ROLES: OperationalRole[] = [
  "acheteur",
  "caissier",
  "facturier",
  "vendeur",
];

export const ROLE_IDS: RoleId[] = [
  "admin_entreprise",
  "comptable",
  "acheteur",
  "caissier",
  "facturier",
  "vendeur",
  "lecture_seule",
];

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
  "achats.lire",
  "achats.gerer",
  "rentabilite.lire",
  "parametres.lire",
  "parametres.gerer",
  "navigation.identite",
  "users.gerer",
  "audit.lire",
  "securite.gerer",
  "sites.vue_globale",
  "ventes.deroger_credit",
  "fabrication.deroger_bat",
  "comptabilite.lire",
  "comptabilite.gerer",
  "missions.lire",
  "missions.gerer",
]);

export type Permission = z.infer<typeof PermissionSchema>;

export const ROLE_LABELS: Record<RoleId, string> = {
  admin_entreprise: "Administrateur entreprise",
  comptable: "Comptable",
  acheteur: "Acheteur",
  caissier: "Caissier",
  facturier: "Facturier",
  vendeur: "Vendeur",
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
    "achats.lire",
    "achats.gerer",
    "rentabilite.lire",
    "parametres.lire",
    "parametres.gerer",
    "navigation.identite",
    "users.gerer",
    "audit.lire",
    "securite.gerer",
    "sites.vue_globale",
    "ventes.deroger_credit",
    "fabrication.deroger_bat",
    "comptabilite.lire",
    "comptabilite.gerer",
    "missions.lire",
    "missions.gerer",
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
    "achats.lire",
    "achats.gerer",
    "rentabilite.lire",
    "parametres.lire",
    "audit.lire",
    "sites.vue_globale",
    "ventes.deroger_credit",
    "fabrication.deroger_bat",
    "comptabilite.lire",
    "comptabilite.gerer",
    "missions.lire",
    "missions.gerer",
  ],
  acheteur: [
    "achats.lire",
    "achats.gerer",
    "produits.lire",
    "clients.lire",
    "missions.lire",
    "missions.gerer",
  ],
  caissier: [
    "factures.lire",
    "factures.creer",
    "factures.encaisser",
    "produits.lire",
    "clients.lire",
    "commercial.lire",
  ],
  facturier: [
    "factures.lire",
    "factures.creer",
    "factures.modifier",
    "factures.valider",
    "factures.avoir",
    "produits.lire",
    "clients.lire",
    "clients.gerer",
    "commercial.lire",
  ],
  vendeur: [
    "factures.lire",
    "produits.lire",
    "clients.lire",
    "clients.gerer",
    "commercial.lire",
    "commercial.gerer",
    "rentabilite.lire",
  ],
  lecture_seule: [
    "factures.lire",
    "produits.lire",
    "clients.lire",
    "commercial.lire",
    "achats.lire",
    "rentabilite.lire",
    "parametres.lire",
    "audit.lire",
    "comptabilite.lire",
    "missions.lire",
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
  "achats.lire": "Achats — lecture",
  "achats.gerer": "Achats — gestion",
  "rentabilite.lire": "Rentabilité — lecture",
  "parametres.lire": "Paramètres — lecture",
  "parametres.gerer": "Paramètres — gestion",
  "navigation.identite": "Menu — identité (nom et logo)",
  "users.gerer": "Utilisateurs — gestion",
  "audit.lire": "Journal d'audit — lecture",
  "securite.gerer": "Sécurité — gestion",
  "sites.vue_globale": "Sites — vue globale (tous les stocks)",
  "ventes.deroger_credit": "Ventes — dérogation au plafond de crédit",
  "fabrication.deroger_bat": "Fabrication — dérogation BAT (démarrer sans BAT validé)",
  "comptabilite.lire": "Comptabilité — lecture",
  "comptabilite.gerer": "Comptabilité — plan et écritures",
  "missions.lire": "Missions d'achat — lecture",
  "missions.gerer": "Missions d'achat — création, clôture et règlement",
};

export function isRoleId(value: string): value is RoleId {
  return (ROLE_IDS as string[]).includes(value);
}

export function normalizeRole(role: string): RoleId {
  if (role === "admin") return "admin_entreprise";
  if (role === "commercial") return "vendeur";
  if (isRoleId(role)) return role;
  return "lecture_seule";
}

function uniqueRoles(roles: RoleId[]): RoleId[] {
  const seen = new Set<RoleId>();
  const out: RoleId[] = [];
  for (const r of roles) {
    if (!seen.has(r)) {
      seen.add(r);
      out.push(r);
    }
  }
  return out.length ? out : ["lecture_seule"];
}

/** Ancien rôle unique « commercial » = vendeur + facturier. */
export function rolesFromStored(role: string, extra?: unknown): RoleId[] {
  const fromJson = Array.isArray(extra)
    ? extra
        .filter((r): r is string => typeof r === "string")
        .map(normalizeRole)
    : [];
  if (fromJson.length) return uniqueRoles(fromJson);
  if (role === "commercial") return ["vendeur", "facturier"];
  return uniqueRoles([normalizeRole(role)]);
}

export function primaryRole(roles: RoleId[]): RoleId {
  if (roles.includes("admin_entreprise")) return "admin_entreprise";
  if (roles.includes("comptable")) return "comptable";
  for (const r of OPERATIONAL_ROLES) {
    if (roles.includes(r)) return r;
  }
  if (roles.includes("lecture_seule")) return "lecture_seule";
  return roles[0] ?? "lecture_seule";
}

export function permissionsForRoles(roles: RoleId[]): Permission[] {
  const set = new Set<Permission>();
  for (const r of roles) {
    for (const p of ROLE_PERMISSIONS[r] ?? []) set.add(p);
  }
  return [...set];
}

export function roleHasPermission(role: RoleId, permission: Permission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function userHasPermission(
  user: { role: string; roles?: unknown },
  permission: Permission,
) {
  return permissionsForRoles(rolesFromStored(user.role, user.roles)).includes(
    permission,
  );
}

export function estAdministrateur(user: { role: string; roles?: unknown }) {
  return rolesFromStored(user.role, user.roles).includes("admin_entreprise");
}

export function libelleRoles(roles: RoleId[]): string {
  return roles.map((r) => ROLE_LABELS[r]).join(" · ");
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

export const CreateUserBodySchema = z
  .object({
    email: z.string().email().max(255),
    nom: z.string().min(1).max(200),
    role: RoleIdSchema.optional(),
    roles: z.array(RoleIdSchema).min(1).optional(),
    pointDeVenteIds: z.array(z.string().max(64)).default([]),
    password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
    mfaRequired: z.boolean().optional(),
  })
  .refine((v) => Boolean(v.role) || (v.roles && v.roles.length > 0), {
    message: "Indiquez au moins un rôle",
  });

export const UpdateUserBodySchema = z
  .object({
    nom: z.string().min(1).max(200).optional(),
    role: RoleIdSchema.optional(),
    roles: z.array(RoleIdSchema).min(1).optional(),
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
