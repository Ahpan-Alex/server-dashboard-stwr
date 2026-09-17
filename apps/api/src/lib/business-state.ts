const PARAMETRES_ALERTES_DEFAUT = {
  achatEcheanceApproche: { actif: true, delaiJours: 7 },
  achatEcheanceDepassee: { actif: true },
  achatLivraisonPartielle: { actif: true, delaiJours: 7 },
  venteEcheanceApproche: { actif: true, delaiJours: 7 },
  venteImpayee: { actif: true },
  ventePartielleSansMouvement: { actif: true, delaiJours: 14 },
  stockReappro: { actif: true },
  stockRupture: { actif: true },
  stockSurstock: { actif: true },
  stockPeremption: { actif: true, delaiJours: 3 },
};

export type ParametresAlertes = typeof PARAMETRES_ALERTES_DEFAUT;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function fusionnerRegleAlerte<T extends { actif: boolean; delaiJours?: number }>(
  defaut: T,
  raw: unknown,
): T {
  const src = asRecord(raw);
  if (!src) return { ...defaut };
  const next: T = { ...defaut };
  if (typeof src.actif === "boolean") next.actif = src.actif;
  if (
    "delaiJours" in defaut &&
    typeof src.delaiJours === "number" &&
    Number.isFinite(src.delaiJours) &&
    src.delaiJours >= 0
  ) {
    (next as { actif: boolean; delaiJours?: number }).delaiJours =
      Math.floor(src.delaiJours);
  }
  return next;
}

/** Fusionne un payload partiel avec les délais / activations par défaut. */
export function normaliserParametresAlertes(raw: unknown): ParametresAlertes {
  const src = asRecord(raw) ?? {};
  return {
    achatEcheanceApproche: fusionnerRegleAlerte(
      PARAMETRES_ALERTES_DEFAUT.achatEcheanceApproche,
      src.achatEcheanceApproche,
    ),
    achatEcheanceDepassee: fusionnerRegleAlerte(
      PARAMETRES_ALERTES_DEFAUT.achatEcheanceDepassee,
      src.achatEcheanceDepassee,
    ),
    achatLivraisonPartielle: fusionnerRegleAlerte(
      PARAMETRES_ALERTES_DEFAUT.achatLivraisonPartielle,
      src.achatLivraisonPartielle,
    ),
    venteEcheanceApproche: fusionnerRegleAlerte(
      PARAMETRES_ALERTES_DEFAUT.venteEcheanceApproche,
      src.venteEcheanceApproche,
    ),
    venteImpayee: fusionnerRegleAlerte(
      PARAMETRES_ALERTES_DEFAUT.venteImpayee,
      src.venteImpayee,
    ),
    ventePartielleSansMouvement: fusionnerRegleAlerte(
      PARAMETRES_ALERTES_DEFAUT.ventePartielleSansMouvement,
      src.ventePartielleSansMouvement,
    ),
    stockReappro: fusionnerRegleAlerte(
      PARAMETRES_ALERTES_DEFAUT.stockReappro,
      src.stockReappro,
    ),
    stockRupture: fusionnerRegleAlerte(
      PARAMETRES_ALERTES_DEFAUT.stockRupture,
      src.stockRupture,
    ),
    stockSurstock: fusionnerRegleAlerte(
      PARAMETRES_ALERTES_DEFAUT.stockSurstock,
      src.stockSurstock,
    ),
    stockPeremption: fusionnerRegleAlerte(
      PARAMETRES_ALERTES_DEFAUT.stockPeremption,
      src.stockPeremption,
    ),
  };
}

/** État métier vide (nouveaux tenants / reset). */
export function emptyBusinessState() {
  const MENTIONS =
    "Document établi conformément à la réglementation fiscale malagasy. NIF et STAT obligatoires. En cas d'acompte, une facture d'acompte est émise. TVA exigible selon le régime applicable.";

  const rubriques = {
    devis: [
      "entete_entreprise",
      "logo",
      "nif",
      "stat",
      "rcs",
      "coordonnees_entreprise",
      "client",
      "client_nif",
      "numero_date",
      "lignes",
      "totaux_ht_tva_ttc",
      "acomptes",
      "net_a_payer",
      "conditions_paiement",
      "mentions_legales",
      "signature_cachet",
    ],
    commande: [
      "entete_entreprise",
      "logo",
      "nif",
      "stat",
      "rcs",
      "coordonnees_entreprise",
      "client",
      "client_nif",
      "numero_date",
      "reference_devis",
      "lignes",
      "totaux_ht_tva_ttc",
      "acomptes",
      "net_a_payer",
      "conditions_paiement",
      "echeance",
      "mentions_legales",
      "signature_cachet",
    ],
    bon_de_livraison: [
      "entete_entreprise",
      "logo",
      "nif",
      "stat",
      "rcs",
      "coordonnees_entreprise",
      "client",
      "client_nif",
      "numero_date",
      "reference_devis",
      "reference_commande",
      "lignes",
      "totaux_ht_tva_ttc",
      "net_a_payer",
      "conditions_paiement",
      "mentions_legales",
      "signature_cachet",
    ],
    facture: [
      "entete_entreprise",
      "logo",
      "nif",
      "stat",
      "rcs",
      "coordonnees_entreprise",
      "rib",
      "client",
      "client_nif",
      "numero_date",
      "reference_devis",
      "reference_commande",
      "reference_bl",
      "lignes",
      "totaux_ht_tva_ttc",
      "acomptes",
      "net_a_payer",
      "conditions_paiement",
      "echeance",
      "mentions_legales",
      "signature_cachet",
    ],
  } as const;

  const preferencesModeles: Record<string, unknown> = {};

  const modelesDocuments = (
    ["devis", "commande", "bon_de_livraison", "facture"] as const
  ).map((type) => ({
    id: `modele-${type}-defaut`,
    nom: `Modèle ${type.replaceAll("_", " ")} (législation MG)`,
    type,
    rubriques: [...rubriques[type]],
    mentionsLegales: MENTIONS,
    piedDePage: "Merci de votre confiance",
    actif: true,
  }));

  return {
    pointDeVenteActifId: "tous" as const,
    parametres: {
      nomEntreprise: "",
      formeJuridique: "SARL",
      capital: 0,
      devise: "Ar" as const,
      nif: "",
      stat: "",
      rcs: "",
      adresse: "",
      ville: "",
      telephone: "",
      email: "",
      rib: "",
      banque: "",
      tauxTVA: 20,
      assujettiTVA: true,
      regimeFiscal: "tva" as const,
      seuilMargePalier1Percent: 25,
      seuilMargePalier2Percent: 5,
      conditionsPaiementDefaut:
        "Paiement à 30 jours. Acompte de 30 % à la commande. Espèces, virement ou Mobile Money.",
    },
    identiteNavigation: { nom: "" },
    modelesDocuments,
    preferencesModeles,
    preferencesAffichage: {},
    parametresAlertes: { ...PARAMETRES_ALERTES_DEFAUT },
    alertesSuivi: {},
    bilanInitial: {
      date: new Date().toISOString(),
      immobilisations: 0,
      stocks: 0,
      creancesClients: 0,
      disponibilites: 0,
      capital: 0,
      dettesFournisseurs: 0,
      dettesSociales: 0,
      emprunts: 0,
      resultatReporte: 0,
      compteCourantAssocie: 0,
    },
    immobilisations: [] as unknown[],
    mouvementsCompteCourant: [] as unknown[],
    clients: [] as unknown[],
    fournisseurs: [] as unknown[],
    tiers: [] as unknown[],
    devis: [] as unknown[],
    commandes: [] as unknown[],
    bonsDeLivraison: [] as unknown[],
    factures: [] as unknown[],
    acomptes: [] as unknown[],
    transformations: [] as unknown[],
    pointsDeVente: [] as unknown[],
    categoriesProduits: [
      {
        id: "cat-mer",
        code: "MER",
        libelle: "Produits de la mer",
        ordre: 0,
        actif: true,
      },
      {
        id: "cat-poisson",
        code: "POI",
        libelle: "Poissons",
        parentId: "cat-mer",
        ordre: 1,
        actif: true,
      },
      {
        id: "cat-crustace",
        code: "CRU",
        libelle: "Crustacés",
        parentId: "cat-mer",
        ordre: 2,
        actif: true,
      },
      {
        id: "cat-coquillage",
        code: "COQ",
        libelle: "Coquillages",
        parentId: "cat-mer",
        ordre: 3,
        actif: true,
      },
      {
        id: "cat-autre",
        code: "AUT",
        libelle: "Autres",
        ordre: 99,
        actif: true,
      },
    ],
    unitesMesure: [
      { id: "um-pce", symbole: "pce", libelle: "Pièce", ordre: 1, actif: true },
      { id: "um-rl", symbole: "rl", libelle: "Rouleau", ordre: 2, actif: true },
      { id: "um-kg", symbole: "kg", libelle: "Kilogramme", ordre: 3, actif: true },
      { id: "um-g", symbole: "g", libelle: "Gramme", ordre: 4, actif: true },
      { id: "um-t", symbole: "t", libelle: "Tonne", ordre: 5, actif: true },
      { id: "um-m", symbole: "m", libelle: "Mètre", ordre: 6, actif: true },
      { id: "um-m2", symbole: "m²", libelle: "Mètre carré", ordre: 7, actif: true },
      { id: "um-m3", symbole: "m³", libelle: "Mètre cube", ordre: 8, actif: true },
      { id: "um-l", symbole: "L", libelle: "Litre", ordre: 9, actif: true },
      { id: "um-ml", symbole: "mL", libelle: "Millilitre", ordre: 10, actif: true },
      { id: "um-h", symbole: "h", libelle: "Heure", ordre: 11, actif: true },
      { id: "um-sac", symbole: "sac", libelle: "Sac", ordre: 12, actif: true },
      { id: "um-carton", symbole: "carton", libelle: "Carton", ordre: 13, actif: true },
      { id: "um-lot", symbole: "lot", libelle: "Lot", ordre: 14, actif: true },
      { id: "um-paire", symbole: "paire", libelle: "Paire", ordre: 15, actif: true },
      { id: "um-boite", symbole: "boîte", libelle: "Boîte", ordre: 16, actif: true },
      { id: "um-u", symbole: "u", libelle: "Unité", ordre: 17, actif: true },
      { id: "um-forfait", symbole: "forfait", libelle: "Forfait", ordre: 18, actif: true },
    ],
    typesClients: [
      { id: "tc-particulier", code: "particulier", libelle: "Particulier", ordre: 1, actif: true },
      { id: "tc-restaurant", code: "restaurant", libelle: "Restaurant", ordre: 2, actif: true },
      { id: "tc-hotel", code: "hotel", libelle: "Hôtel", ordre: 3, actif: true },
      { id: "tc-grossiste", code: "grossiste", libelle: "Grossiste", ordre: 4, actif: true },
      { id: "tc-autre", code: "autre", libelle: "Autre", ordre: 5, actif: true },
    ],
    naturesDepenseMission: [
      { id: "ndm-transport", libelle: "Transport", ordre: 1, actif: true },
      { id: "ndm-carburant", libelle: "Carburant", ordre: 2, actif: true },
      { id: "ndm-repas", libelle: "Repas", ordre: 3, actif: true },
      { id: "ndm-hebergement", libelle: "Hébergement", ordre: 4, actif: true },
      { id: "ndm-divers", libelle: "Divers", ordre: 5, actif: true },
    ],
    exercicesComptables: [] as unknown[],
    produits: [] as unknown[],
    tarifsClients: [] as unknown[],
    historiquesPrix: [] as unknown[],
    journalAudit: [] as unknown[],
    entrees: [] as unknown[],
    achats: [] as unknown[],
    transfertsStock: [] as unknown[],
    ordresFabrication: [] as unknown[],
    bonsATirer: [] as unknown[],
    missionsAchat: [] as unknown[],
    demandesPrix: [] as unknown[],
    ventes: [],
    rapportsFinJournee: [] as unknown[],
    inventaires: [] as unknown[],
    journalActivites: [] as unknown[],
    comptesComptables: [] as unknown[],
    ecrituresComptables: [] as unknown[],
    transfertsComptables: [] as unknown[],
  };
}

export type BusinessPayload = ReturnType<typeof emptyBusinessState>;

const STATE_KEYS = [
  "parametres",
  "identiteNavigation",
  "modelesDocuments",
  "preferencesModeles",
  "preferencesAffichage",
  "parametresAlertes",
  "alertesSuivi",
  "bilanInitial",
  "immobilisations",
  "mouvementsCompteCourant",
  "clients",
  "fournisseurs",
  "tiers",
  "devis",
  "commandes",
  "bonsDeLivraison",
  "factures",
  "acomptes",
  "transformations",
  "pointsDeVente",
  "categoriesProduits",
  "unitesMesure",
  "typesClients",
  "naturesDepenseMission",
  "exercicesComptables",
  "produits",
  "tarifsClients",
  "historiquesPrix",
  "journalAudit",
  "entrees",
  "achats",
  "transfertsStock",
  "ordresFabrication",
  "bonsATirer",
  "missionsAchat",
  "demandesPrix",
  "ventes",
  "rapportsFinJournee",
  "inventaires",
  "journalActivites",
  "comptesComptables",
  "ecrituresComptables",
  "transfertsComptables",
  "pointDeVenteActifId",
] as const;

/** Valide et normalise un payload métier (merge avec défauts). */
export function normalizeBusinessPayload(raw: unknown): BusinessPayload {
  const base = emptyBusinessState();
  if (!raw || typeof raw !== "object") return base;
  const src = raw as Record<string, unknown>;
  const out = { ...base } as Record<string, unknown>;
  for (const key of STATE_KEYS) {
    if (src[key] !== undefined) out[key] = src[key];
  }
  out.parametresAlertes = normaliserParametresAlertes(out.parametresAlertes);
  return out as BusinessPayload;
}
