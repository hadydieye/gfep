import { PrismaClient } from '@prisma/client';

/**
 * Seed du catalogue de scénarios pédagogiques (T-INFRA-3).
 * Insère les 8 scénarios WEB avec enabled=false. L'activation se fait
 * par UPDATE SQL direct en base — jamais depuis l'interface.
 *
 * Exécution : npx tsx prisma/seed-lab.ts
 */
const SCENARIOS = [
  {
    scenarioCode: 'WEB-01',
    name: 'SQL Injection — employees/search',
    vulnerabilityCategory: 'Injection',
    description: 'UNION-based SQL injection via paramètre de recherche non paramétré. Exfiltre username, email et passwordHash de la table users.',
    mode: 'lab',
    enabled: false,
  },
  {
    scenarioCode: 'WEB-02',
    name: 'IDOR — documents/download',
    vulnerabilityCategory: 'Broken Object Level Authorization',
    description: 'Accès direct à un document sans vérification de visibilité M9. Un employé peut télécharger un document RESTRICTED d\'un autre département.',
    mode: 'lab',
    enabled: false,
  },
  {
    scenarioCode: 'WEB-03',
    name: 'Broken Access Control — elévation de rôle',
    vulnerabilityCategory: 'Broken Access Control',
    description: 'Endpoint sans authentification permettant l\'attribution du rôle SUPER_ADMIN à n\'importe quel compte.',
    mode: 'lab',
    enabled: false,
  },
  {
    scenarioCode: 'WEB-04',
    name: 'Stored XSS — commentaires de documents',
    vulnerabilityCategory: 'XSS',
    description: 'Injection de script via champ commentaire sans sanitisation. Le contenu est stocké et retourné brut.',
    mode: 'lab',
    enabled: false,
  },
  {
    scenarioCode: 'WEB-05',
    name: 'Unrestricted File Upload',
    vulnerabilityCategory: 'Security Misconfiguration',
    description: 'Upload de fichier sans vérification de type (signature) ni de taille. Le Content-Type déclaré par le client est retourné au téléchargement.',
    mode: 'lab',
    enabled: false,
  },
  {
    scenarioCode: 'WEB-06',
    name: 'Session Fixation',
    vulnerabilityCategory: 'Session Management',
    description: 'Fixation de jeton de session via header X-Session-Fix. L\'attaquant impose un token connu avant la connexion de la victime.',
    mode: 'lab',
    enabled: false,
  },
  {
    scenarioCode: 'WEB-07',
    name: 'Mass Assignment — modification d\'employé',
    vulnerabilityCategory: 'Mass Assignment',
    description: 'DTO acceptant positionId et departmentId sans restriction de scope. Un employé peut modifier son propre poste et département.',
    mode: 'lab',
    enabled: false,
  },
  {
    scenarioCode: 'WEB-08',
    name: 'Command Injection — convert',
    vulnerabilityCategory: 'Injection',
    description: 'Injection de commande Windows via paramètre format non échappé. Confinée : spawn, répertoire scratch, env minimal, timeout 5 s.',
    mode: 'lab',
    enabled: false,
  },
] as const;

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL manquant.');
  // Refus en production (même garde-fou que le seed principal)
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed-lab.ts ne doit pas être exécuté en production.');
  }

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });

  try {
    for (const scenario of SCENARIOS) {
      await prisma.labScenario.upsert({
        where: { scenarioCode: scenario.scenarioCode },
        create: { ...scenario },
        update: { name: scenario.name, description: scenario.description, vulnerabilityCategory: scenario.vulnerabilityCategory },
      });
    }

    const count = await prisma.labScenario.count();
    const allEnabledFalse = await prisma.labScenario.count({ where: { enabled: true } });
    console.log(`Seed lab : ${count} scénarios insérés, ${allEnabledFalse} activés (attendu : 0).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
