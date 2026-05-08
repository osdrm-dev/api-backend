import {
  PrismaClient,
  ItAssetStatus,
  ItDemandStatus,
  ItAttributionStatus,
} from '@prisma/client';

const today = new Date();
const daysAgo = (n: number) => new Date(today.getTime() - n * 86_400_000);
const monthsAgo = (n: number) =>
  new Date(today.getTime() - n * 30 * 86_400_000);

export async function seedParcInformatique(
  prisma: PrismaClient,
  userMap: Record<string, any>,
) {
  await prisma.itAttribution.deleteMany();
  await prisma.itDemand.deleteMany();
  await prisma.itAsset.deleteMany();
  await prisma.itCategory.deleteMany();

  // ─── Categories ───────────────────────────────────────────────────────────
  const categories = await Promise.all([
    prisma.itCategory.create({
      data: {
        name: 'Ordinateurs portables',
        description: 'Laptops et ultrabooks pour le personnel',
        depreciationYears: 3,
      },
    }),
    prisma.itCategory.create({
      data: {
        name: 'Ordinateurs fixes',
        description: 'Desktops et stations de travail',
        depreciationYears: 4,
      },
    }),
    prisma.itCategory.create({
      data: {
        name: 'Imprimantes & Scanners',
        description: "Imprimantes laser, jet d'encre et scanners",
        depreciationYears: 5,
      },
    }),
    prisma.itCategory.create({
      data: {
        name: 'Serveurs & Infrastructure',
        description: 'Serveurs, NAS et équipements réseau',
        depreciationYears: 5,
      },
    }),
    prisma.itCategory.create({
      data: {
        name: 'Périphériques',
        description: 'Écrans, claviers, souris, webcams',
        depreciationYears: 3,
      },
    }),
    prisma.itCategory.create({
      data: {
        name: 'Téléphonie',
        description: 'Smartphones et téléphones IP',
        depreciationYears: 2,
      },
    }),
  ]);

  const [
    catLaptop,
    catDesktop,
    catPrinter,
    catServer,
    catPeripherique,
    catPhone,
  ] = categories;

  // ─── Assets ───────────────────────────────────────────────────────────────
  const assets = [
    // Laptops
    {
      categoryId: catLaptop.id,
      designation: 'Dell Latitude 5540',
      serialNumber: 'DL5540-001',
      supplierReference: 'DELL-LAT5540-i7',
      status: ItAssetStatus.BON,
      location: 'Siège — Antananarivo',
      acquisitionDate: monthsAgo(18),
      purchasePrice: 1850000,
      quantiteTotal: 5,
      quantiteAttribuee: 4,
      seuilAlerte: 1,
    },
    {
      categoryId: catLaptop.id,
      designation: 'HP EliteBook 840 G10',
      serialNumber: 'HP840G10-002',
      supplierReference: 'HP-EB840G10-i5',
      status: ItAssetStatus.BON,
      location: 'Bureau Toamasina',
      acquisitionDate: monthsAgo(12),
      purchasePrice: 1650000,
      quantiteTotal: 3,
      quantiteAttribuee: 3,
      seuilAlerte: 1,
    },
    {
      categoryId: catLaptop.id,
      designation: 'Lenovo ThinkPad E14',
      serialNumber: 'LNV-E14-003',
      supplierReference: 'LEN-TPE14-AMD',
      status: ItAssetStatus.USAGE,
      location: 'Bureau Fianarantsoa',
      acquisitionDate: monthsAgo(36),
      purchasePrice: 1200000,
      quantiteTotal: 2,
      quantiteAttribuee: 2,
      seuilAlerte: 1,
      depreciationOverrideYears: 4,
    },
    // Desktops
    {
      categoryId: catDesktop.id,
      designation: 'HP ProDesk 400 G9',
      serialNumber: 'HP400G9-004',
      supplierReference: 'HP-PD400G9-i5',
      status: ItAssetStatus.NEUF,
      location: 'Siège — Antananarivo',
      acquisitionDate: monthsAgo(2),
      purchasePrice: 1100000,
      quantiteTotal: 4,
      quantiteAttribuee: 0,
      seuilAlerte: 1,
    },
    {
      categoryId: catDesktop.id,
      designation: 'Dell OptiPlex 3000',
      serialNumber: 'DL3000-005',
      supplierReference: 'DELL-OPT3000-i3',
      status: ItAssetStatus.BON,
      location: 'Siège — Antananarivo',
      acquisitionDate: monthsAgo(24),
      purchasePrice: 950000,
      quantiteTotal: 6,
      quantiteAttribuee: 5,
      seuilAlerte: 1,
    },
    // Printers
    {
      categoryId: catPrinter.id,
      designation: 'HP LaserJet Pro M404dn',
      serialNumber: 'HLJ-M404-006',
      supplierReference: 'HP-LJM404DN',
      status: ItAssetStatus.BON,
      location: 'Siège — Antananarivo',
      acquisitionDate: monthsAgo(20),
      purchasePrice: 620000,
      quantiteTotal: 2,
      quantiteAttribuee: 0,
      seuilAlerte: 1,
    },
    {
      categoryId: catPrinter.id,
      designation: 'Canon PIXMA G3470',
      serialNumber: 'CPN-G3470-007',
      supplierReference: 'CAN-PIXG3470',
      status: ItAssetStatus.EN_PANNE,
      location: 'Bureau Mahajanga',
      acquisitionDate: monthsAgo(30),
      purchasePrice: 380000,
      quantiteTotal: 1,
      quantiteAttribuee: 0,
      seuilAlerte: 1,
    },
    // Servers
    {
      categoryId: catServer.id,
      designation: 'Dell PowerEdge T40',
      serialNumber: 'DPE-T40-008',
      supplierReference: 'DELL-PET40-XEON',
      status: ItAssetStatus.BON,
      location: 'Salle serveurs — Siège',
      acquisitionDate: monthsAgo(30),
      purchasePrice: 4200000,
      quantiteTotal: 1,
      quantiteAttribuee: 0,
      seuilAlerte: 1,
    },
    {
      categoryId: catServer.id,
      designation: 'Switch HP Aruba 2530-24',
      serialNumber: 'HPAruba-2530-009',
      supplierReference: 'HP-ARB2530-24G',
      status: ItAssetStatus.BON,
      location: 'Salle serveurs — Siège',
      acquisitionDate: monthsAgo(40),
      purchasePrice: 1800000,
      quantiteTotal: 2,
      quantiteAttribuee: 0,
      seuilAlerte: 1,
    },
    // Peripheriques
    {
      categoryId: catPeripherique.id,
      designation: 'Écran Dell 24" P2422H',
      serialNumber: 'DELL-P2422H-010',
      supplierReference: 'DELL-P2422H',
      status: ItAssetStatus.BON,
      location: 'Siège — Antananarivo',
      acquisitionDate: monthsAgo(15),
      purchasePrice: 480000,
      quantiteTotal: 8,
      quantiteAttribuee: 6,
      seuilAlerte: 2,
    },
    {
      categoryId: catPeripherique.id,
      designation: 'Webcam Logitech C920',
      serialNumber: 'LOG-C920-011',
      supplierReference: 'LOG-C920-HD',
      status: ItAssetStatus.BON,
      location: 'Siège — Antananarivo',
      acquisitionDate: monthsAgo(10),
      purchasePrice: 195000,
      quantiteTotal: 5,
      quantiteAttribuee: 4,
      seuilAlerte: 1,
    },
    // Phones
    {
      categoryId: catPhone.id,
      designation: 'Samsung Galaxy A54',
      serialNumber: 'SAM-A54-012',
      supplierReference: 'SAM-A54-128GB',
      status: ItAssetStatus.BON,
      location: 'Siège — Antananarivo',
      acquisitionDate: monthsAgo(8),
      purchasePrice: 750000,
      quantiteTotal: 4,
      quantiteAttribuee: 4,
      seuilAlerte: 1,
    },
    {
      categoryId: catPhone.id,
      designation: 'iPhone 13',
      serialNumber: 'APL-IP13-013',
      supplierReference: 'APL-IP13-128',
      status: ItAssetStatus.HORS_SERVICE,
      location: 'Bureau Toamasina',
      acquisitionDate: monthsAgo(48),
      purchasePrice: 1400000,
      quantiteTotal: 1,
      quantiteAttribuee: 0,
      seuilAlerte: 1,
    },
  ];

  const createdAssets: Record<string, any> = {};
  for (const a of assets) {
    const asset = await prisma.itAsset.create({ data: a });
    createdAssets[a.serialNumber] = asset;
  }

  // ─── Demands ──────────────────────────────────────────────────────────────
  const demands = [
    {
      reference: 'ITD-2026-0001',
      requestorId: userMap['demandeur1'].id,
      categoryId: catLaptop.id,
      desiredType: 'Ordinateur portable 15" — i5 / 16 Go RAM / SSD 512 Go',
      quantity: 2,
      justification:
        "Les deux agents de terrain au bureau de Mahajanga n'ont pas de postes informatiques. Ils utilisent leurs téléphones personnels pour accéder aux outils métier, ce qui est insuffisant.",
      status: ItDemandStatus.EN_ATTENTE,
      createdAt: daysAgo(7),
    },
    {
      reference: 'ITD-2026-0002',
      requestorId: userMap['demandeur2'].id,
      categoryId: catPhone.id,
      desiredType: 'Smartphone Android 6" — 128 Go',
      quantity: 1,
      justification:
        "Le smartphone attribué à la coordinatrice régionale est tombé en panne irréparable. Elle a besoin d'un remplacement pour les communications terrain.",
      status: ItDemandStatus.APPROUVEE,
      adminNote: 'Approuvée. Attribution à effectuer dès disponibilité stock.',
      createdAt: daysAgo(14),
    },
    {
      reference: 'ITD-2026-0003',
      requestorId: userMap['demandeur1'].id,
      categoryId: catPrinter.id,
      desiredType: 'Imprimante laser noir & blanc A4 réseau',
      quantity: 1,
      justification:
        "L'imprimante du bureau de Fianarantsoa est hors service depuis 3 semaines. Les agents doivent se déplacer au siège pour imprimer les contrats, causant des retards opérationnels.",
      status: ItDemandStatus.REFUSEE,
      adminNote:
        'Refusée pour ce trimestre — budget IT gelé. À reprioriser en Q3 2026.',
      createdAt: daysAgo(21),
    },
    {
      reference: 'ITD-2026-0004',
      requestorId: userMap['demandeur2'].id,
      categoryId: catPeripherique.id,
      desiredType: 'Écran externe 24" Full HD + support ergonomique',
      quantity: 3,
      justification:
        "Les trois nouveaux recrutés du service comptabilité n'ont pas d'écrans secondaires. Le travail sur deux écrans est indispensable pour le traitement des tableaux Excel et des dossiers d'achat.",
      status: ItDemandStatus.EN_ATTENTE,
      createdAt: daysAgo(3),
    },
    {
      reference: 'ITD-2026-0005',
      requestorId: userMap['demandeur1'].id,
      categoryId: catServer.id,
      desiredType: 'NAS 4 baies pour sauvegarde locale',
      quantity: 1,
      justification:
        "Il n'existe aucune solution de sauvegarde locale au bureau régional de Toamasina. En cas de perte de connexion, l'accès aux données critiques est impossible. Un NAS est nécessaire.",
      status: ItDemandStatus.EN_ATTENTE,
      createdAt: daysAgo(1),
    },
  ];

  const createdDemands: Record<string, any> = {};
  for (const d of demands) {
    const demand = await prisma.itDemand.create({ data: d });
    createdDemands[d.reference] = demand;
  }

  // ─── Attributions ─────────────────────────────────────────────────────────
  const attributions = [
    // Dell Latitude 5540 → demandeur1 (ACTIVE)
    {
      assetId: createdAssets['DL5540-001'].id,
      beneficiaryId: userMap['demandeur1'].id,
      quantity: 2,
      attributedAt: monthsAgo(16),
      status: ItAttributionStatus.ACTIVE,
      notes: 'Attribution initiale pour équipe terrain Antananarivo.',
    },
    // Dell Latitude 5540 → demandeur2 (ACTIVE)
    {
      assetId: createdAssets['DL5540-001'].id,
      beneficiaryId: userMap['demandeur2'].id,
      quantity: 2,
      attributedAt: monthsAgo(14),
      status: ItAttributionStatus.ACTIVE,
      notes: 'Attribution responsable régional Toamasina.',
    },
    // HP EliteBook 840 → admin (ACTIVE)
    {
      assetId: createdAssets['HP840G10-002'].id,
      beneficiaryId: userMap['admin'].id,
      quantity: 3,
      attributedAt: monthsAgo(10),
      status: ItAttributionStatus.ACTIVE,
      notes: 'Attribution équipe administrative.',
    },
    // Lenovo ThinkPad → demandeur1 (ACTIVE)
    {
      assetId: createdAssets['LNV-E14-003'].id,
      beneficiaryId: userMap['demandeur1'].id,
      quantity: 1,
      attributedAt: monthsAgo(34),
      status: ItAttributionStatus.ACTIVE,
      notes: 'Poste terrain Fianarantsoa.',
    },
    // Lenovo ThinkPad → demandeur2 (RETOURNE — retour pour cause panne)
    {
      assetId: createdAssets['LNV-E14-003'].id,
      beneficiaryId: userMap['demandeur2'].id,
      quantity: 1,
      attributedAt: monthsAgo(30),
      returnedAt: monthsAgo(5),
      returnCondition: ItAssetStatus.EN_PANNE,
      status: ItAttributionStatus.RETOURNE,
      notes: 'Retourné — écran cassé suite à chute.',
    },
    // Dell OptiPlex → demandeur1 (ACTIVE)
    {
      assetId: createdAssets['DL3000-005'].id,
      beneficiaryId: userMap['demandeur1'].id,
      quantity: 3,
      attributedAt: monthsAgo(22),
      status: ItAttributionStatus.ACTIVE,
      notes: 'Postes fixes bureau Antananarivo.',
    },
    // Dell OptiPlex → demandeur2 (ACTIVE)
    {
      assetId: createdAssets['DL3000-005'].id,
      beneficiaryId: userMap['demandeur2'].id,
      quantity: 2,
      attributedAt: monthsAgo(20),
      status: ItAttributionStatus.ACTIVE,
      notes: 'Postes fixes bureau Toamasina.',
    },
    // Écrans Dell → demandeur1 (ACTIVE)
    {
      assetId: createdAssets['DELL-P2422H-010'].id,
      beneficiaryId: userMap['demandeur1'].id,
      quantity: 4,
      attributedAt: monthsAgo(13),
      status: ItAttributionStatus.ACTIVE,
      notes: 'Écrans comptabilité Antananarivo.',
    },
    // Écrans Dell → demandeur2 (ACTIVE)
    {
      assetId: createdAssets['DELL-P2422H-010'].id,
      beneficiaryId: userMap['demandeur2'].id,
      quantity: 2,
      attributedAt: monthsAgo(12),
      status: ItAttributionStatus.ACTIVE,
      notes: 'Écrans bureau Toamasina.',
    },
    // Webcams → demandeur1 (ACTIVE)
    {
      assetId: createdAssets['LOG-C920-011'].id,
      beneficiaryId: userMap['demandeur1'].id,
      quantity: 2,
      attributedAt: monthsAgo(9),
      status: ItAttributionStatus.ACTIVE,
      notes: 'Salles de réunion Antananarivo.',
    },
    // Webcams → admin (ACTIVE)
    {
      assetId: createdAssets['LOG-C920-011'].id,
      beneficiaryId: userMap['admin'].id,
      quantity: 2,
      attributedAt: monthsAgo(9),
      status: ItAttributionStatus.ACTIVE,
      notes: 'Bureau direction.',
    },
    // Samsung Galaxy → demandeur1 (ACTIVE)
    {
      assetId: createdAssets['SAM-A54-012'].id,
      beneficiaryId: userMap['demandeur1'].id,
      quantity: 2,
      attributedAt: monthsAgo(7),
      status: ItAttributionStatus.ACTIVE,
      notes: 'Téléphones terrain.',
    },
    // Samsung Galaxy → demandeur2 (ACTIVE)
    {
      assetId: createdAssets['SAM-A54-012'].id,
      beneficiaryId: userMap['demandeur2'].id,
      quantity: 2,
      attributedAt: monthsAgo(7),
      status: ItAttributionStatus.ACTIVE,
      notes: 'Téléphones coordinateurs régionaux.',
    },
    // Attribution liée à la demande ITD-2026-0002 (demande APPROUVEE → pas encore attribuée via stock courant)
    // On simule une attribution passée sur l'iPhone 13 avant sa mise HORS_SERVICE
    {
      assetId: createdAssets['APL-IP13-013'].id,
      beneficiaryId: userMap['demandeur2'].id,
      quantity: 1,
      attributedAt: monthsAgo(46),
      returnedAt: monthsAgo(2),
      returnCondition: ItAssetStatus.HORS_SERVICE,
      status: ItAttributionStatus.RETOURNE,
      notes: 'Retourné — écran brisé et batterie gonflée. Mis hors service.',
    },
  ];

  for (const attr of attributions) {
    await prisma.itAttribution.create({ data: attr });
  }

  console.log(
    `Parc Informatique: 6 catégories | ${assets.length} matériels | ${demands.length} demandes (3 EN_ATTENTE | 1 APPROUVEE | 1 REFUSEE) | ${attributions.length} attributions`,
  );
}
