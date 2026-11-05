/**
 * 50 documents fictifs (gfep-mvp2/design.md §3.2) : environ 8 par catégorie.
 * Niveaux PUBLIC 10, INTERNAL 25, CONFIDENTIAL 10, RESTRICTED 5 ;
 * formats PDF 20, PNG 8, JPG 7, DOCX 8, XLSX 7. La répartition est
 * déterministe (permutation d'indices) pour que le seed reste idempotent.
 */
import {
  ConfidentialityLevel,
  DocumentPermissionType,
  DocumentValidationStatus,
} from '@prisma/client';

export type SeedFileFormat = 'pdf' | 'png' | 'jpg' | 'docx' | 'xlsx';

export interface DocumentSeed {
  title: string;
  /** Code du département de la catégorie */
  category: string;
  level: ConfidentialityLevel;
  validationStatus: DocumentValidationStatus;
  format: SeedFileFormat;
  /** Rang de l'employé propriétaire parmi les employés du département (modulo l'effectif) */
  ownerRank: number;
}

const TITLES: Record<string, string[]> = {
  DG: [
    'Plan stratégique 2026-2028', 'Compte rendu du comité de direction — janvier', 'Note de cadrage budgétaire',
    'Organigramme général', 'Charte de gouvernance', 'Compte rendu du comité de direction — juin',
    'Feuille de route transformation numérique', 'Lettre aux actionnaires', 'Calendrier des instances 2026',
  ],
  RH: [
    'Règlement intérieur', 'Politique de télétravail', 'Grille salariale 2026', 'Plan de formation annuel',
    'Modèle de contrat de travail', 'Procédure d’intégration', 'Bilan social 2025', 'Entretiens annuels — guide',
    'Registre des absences — synthèse',
  ],
  CF: [
    'États financiers 2025', 'Budget prévisionnel 2026', 'Procédure de clôture mensuelle', 'Rapprochement bancaire — septembre',
    'Tableau de trésorerie', 'Politique de dépenses', 'Liasse fiscale 2025', 'Suivi des immobilisations',
  ],
  IT: [
    'Schéma d’architecture du système d’information', 'Politique de mots de passe', 'Plan de reprise d’activité',
    'Inventaire du parc informatique', 'Procédure de sauvegarde', 'Guide de connexion à distance',
    'Matrice des habilitations', 'Charte informatique',
  ],
  CO: [
    'Catalogue des offres 2026', 'Rapport commercial — T3', 'Grille tarifaire entreprises', 'Fiche produit Épargne Plus',
    'Plan de prospection régional', 'Présentation institutionnelle', 'Analyse de satisfaction clients', 'Objectifs commerciaux 2026',
  ],
  AC: [
    'Rapport d’audit interne — achats', 'Cartographie des risques', 'Plan d’audit 2026', 'Procédure de lutte anti-blanchiment',
    'Rapport de conformité réglementaire', 'Suivi des recommandations d’audit', 'Charte de l’audit interne', 'Registre des incidents de conformité',
  ],
};

const LEVELS: ConfidentialityLevel[] = [
  ...Array<ConfidentialityLevel>(10).fill(ConfidentialityLevel.PUBLIC),
  ...Array<ConfidentialityLevel>(25).fill(ConfidentialityLevel.INTERNAL),
  ...Array<ConfidentialityLevel>(10).fill(ConfidentialityLevel.CONFIDENTIAL),
  ...Array<ConfidentialityLevel>(5).fill(ConfidentialityLevel.RESTRICTED),
];

const FORMATS: SeedFileFormat[] = [
  ...Array<SeedFileFormat>(20).fill('pdf'),
  ...Array<SeedFileFormat>(8).fill('png'),
  ...Array<SeedFileFormat>(7).fill('jpg'),
  ...Array<SeedFileFormat>(8).fill('docx'),
  ...Array<SeedFileFormat>(7).fill('xlsx'),
];

const ENTRIES = Object.entries(TITLES).flatMap(([category, titles]) =>
  titles.map((title, rank) => ({ title, category, rank })),
);

// 7 et 11 sont premiers avec 50 : la permutation conserve la répartition et la mélange entre catégories
export const DOCUMENTS: DocumentSeed[] = ENTRIES.map(({ title, category, rank }, index) => ({
  title,
  category,
  level: LEVELS[(index * 7) % ENTRIES.length],
  validationStatus: [
    DocumentValidationStatus.PENDING,
    DocumentValidationStatus.VALIDATED,
    DocumentValidationStatus.REJECTED,
  ][index % 3],
  format: FORMATS[(index * 11) % ENTRIES.length],
  ownerRank: rank,
}));

/**
 * Partages explicites, pour illustrer M9 : un document sensible est rendu
 * lisible par un employé d'un autre département. Les bénéficiaires sont
 * désignés par numéro d'employé.
 */
export const DOCUMENT_SHARES: ReadonlyArray<{
  title: string;
  employee: string;
  permission: DocumentPermissionType;
}> = DOCUMENTS.filter((d) => d.level === 'CONFIDENTIAL' || d.level === 'RESTRICTED')
  .filter((_, index) => index % 3 === 0)
  .map((d, index) => ({
    title: d.title,
    // Bénéficiaire hors du département de la catégorie : m.diallo (CF) ou f.camara (RH)
    employee: d.category === 'CF' ? 'GF-2026-001' : 'GF-2026-002',
    permission: index % 2 === 0 ? DocumentPermissionType.READ : DocumentPermissionType.WRITE,
  }));
