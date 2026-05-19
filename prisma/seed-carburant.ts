import {
  PrismaClient,
  LgCarburantStatus,
  LgTypeCarburant,
} from '@prisma/client';

const today = new Date();
const daysAgo = (n: number) => new Date(today.getTime() - n * 86_400_000);

export async function seedCarburant(
  prisma: PrismaClient,
  userMap: Record<string, any>,
) {
  await prisma.lgCarburantComment.deleteMany();
  await prisma.lgCarburant.deleteMany();

  const year = today.getFullYear();

  // Fetch ACTIF vehicles by immatriculation
  const vehicles = await prisma.vehicle.findMany({
    where: {
      immatriculation: {
        in: [
          '1234 TAA 101',
          '5678 TAA 202',
          '9012 TAB 303',
          '3456 TAC 404',
          '7890 TAD 505',
          '2468 TAE 606',
          '8024 TAG 808',
        ],
      },
    },
    select: { id: true, immatriculation: true },
  });

  const vMap = Object.fromEntries(vehicles.map((v) => [v.immatriculation, v]));

  const entries = [
    // 1. PENDING — Gasoil, Toyota Hilux, demandeur1
    {
      ref: `CAR-${year}-0001`,
      status: LgCarburantStatus.PENDING,
      vehicleImmat: '1234 TAA 101',
      typeCarburant: LgTypeCarburant.GASOIL,
      volumeLitres: 55.0,
      prixUnitaire: 4350.0,
      montantTotal: 239250.0,
      kilometrage: 82450,
      station: 'Jovenna Analakely',
      notes: null as string | null,
      requestorKey: 'demandeur1',
      dateApprovisionnement: daysAgo(1),
      createdAt: daysAgo(1),
    },
    // 2. PENDING — Essence, Toyota Land Cruiser, demandeur2
    {
      ref: `CAR-${year}-0002`,
      status: LgCarburantStatus.PENDING,
      vehicleImmat: '5678 TAA 202',
      typeCarburant: LgTypeCarburant.ESSENCE,
      volumeLitres: 40.0,
      prixUnitaire: 4500.0,
      montantTotal: 180000.0,
      kilometrage: 104320,
      station: 'Total Ambohijatovo',
      notes: 'Plein avant départ mission Toamasina',
      requestorKey: 'demandeur2',
      dateApprovisionnement: daysAgo(2),
      createdAt: daysAgo(2),
    },
    // 3. PENDING — Gasoil, Nissan Navara, demandeur1
    {
      ref: `CAR-${year}-0003`,
      status: LgCarburantStatus.PENDING,
      vehicleImmat: '3456 TAC 404',
      typeCarburant: LgTypeCarburant.GASOIL,
      volumeLitres: 48.5,
      prixUnitaire: 4350.0,
      montantTotal: 210975.0,
      kilometrage: 67800,
      station: 'Galana Antaninandro',
      notes: null,
      requestorKey: 'demandeur1',
      dateApprovisionnement: daysAgo(3),
      createdAt: daysAgo(3),
    },
    // 4. PROCESSED — Gasoil, Mitsubishi L200, demandeur2
    {
      ref: `CAR-${year}-0004`,
      status: LgCarburantStatus.PROCESSED,
      vehicleImmat: '9012 TAB 303',
      typeCarburant: LgTypeCarburant.GASOIL,
      volumeLitres: 60.0,
      prixUnitaire: 4350.0,
      montantTotal: 261000.0,
      kilometrage: 51200,
      station: 'Jovenna Fianarantsoa',
      notes: 'Mission terrain zone sud',
      requestorKey: 'demandeur2',
      dateApprovisionnement: daysAgo(10),
      createdAt: daysAgo(10),
    },
    // 5. PROCESSED — Super, Ford Ranger, demandeur1
    {
      ref: `CAR-${year}-0005`,
      status: LgCarburantStatus.PROCESSED,
      vehicleImmat: '7890 TAD 505',
      typeCarburant: LgTypeCarburant.SUPER,
      volumeLitres: 35.0,
      prixUnitaire: 4650.0,
      montantTotal: 162750.0,
      kilometrage: 28900,
      station: 'Total Behoririka',
      notes: null,
      requestorKey: 'demandeur1',
      dateApprovisionnement: daysAgo(15),
      createdAt: daysAgo(15),
    },
    // 6. PROCESSED — Gasoil, Toyota RAV4, demandeur2
    {
      ref: `CAR-${year}-0006`,
      status: LgCarburantStatus.PROCESSED,
      vehicleImmat: '2468 TAE 606',
      typeCarburant: LgTypeCarburant.GASOIL,
      volumeLitres: 50.0,
      prixUnitaire: null as number | null,
      montantTotal: 217500.0,
      kilometrage: 39100,
      station: null,
      notes: 'Justificatif remis au chauffeur',
      requestorKey: 'demandeur2',
      dateApprovisionnement: daysAgo(20),
      createdAt: daysAgo(20),
    },
    // 7. CANCELLED — Essence, Isuzu MU-X, demandeur1 (erreur de saisie)
    {
      ref: `CAR-${year}-0007`,
      status: LgCarburantStatus.CANCELLED,
      vehicleImmat: '8024 TAG 808',
      typeCarburant: LgTypeCarburant.ESSENCE,
      volumeLitres: 30.0,
      prixUnitaire: 4500.0,
      montantTotal: 135000.0,
      kilometrage: null as number | null,
      station: 'Galana Antananarivo Centre',
      notes: 'Saisie en double — annulation',
      requestorKey: 'demandeur1',
      dateApprovisionnement: daysAgo(8),
      createdAt: daysAgo(8),
    },
    // 8. CANCELLED — GNV, Toyota Hilux, demandeur2 (annulé par admin)
    {
      ref: `CAR-${year}-0008`,
      status: LgCarburantStatus.CANCELLED,
      vehicleImmat: '1234 TAA 101',
      typeCarburant: LgTypeCarburant.GNV,
      volumeLitres: 25.0,
      prixUnitaire: 2800.0,
      montantTotal: 70000.0,
      kilometrage: 82100,
      station: 'Station GNV Isotry',
      notes: 'Type carburant incorrect pour ce véhicule',
      requestorKey: 'demandeur2',
      dateApprovisionnement: daysAgo(12),
      createdAt: daysAgo(12),
    },
    // 9. PROCESSED — Gasoil, Toyota Land Cruiser, demandeur1 (older)
    {
      ref: `CAR-${year}-0009`,
      status: LgCarburantStatus.PROCESSED,
      vehicleImmat: '5678 TAA 202',
      typeCarburant: LgTypeCarburant.GASOIL,
      volumeLitres: 65.0,
      prixUnitaire: 4300.0,
      montantTotal: 279500.0,
      kilometrage: 103750,
      station: 'Total Mahajanga',
      notes: 'Mission nord — Mahajanga',
      requestorKey: 'demandeur1',
      dateApprovisionnement: daysAgo(30),
      createdAt: daysAgo(30),
    },
    // 10. PENDING — Electrique, Ford Ranger, demandeur2
    {
      ref: `CAR-${year}-0010`,
      status: LgCarburantStatus.PENDING,
      vehicleImmat: '7890 TAD 505',
      typeCarburant: LgTypeCarburant.ELECTRIQUE,
      volumeLitres: 20.0,
      prixUnitaire: 1200.0,
      montantTotal: 24000.0,
      kilometrage: 29300,
      station: 'Borne de recharge JIRAMA Analakely',
      notes: 'Recharge véhicule électrique hybride',
      requestorKey: 'demandeur2',
      dateApprovisionnement: daysAgo(0),
      createdAt: daysAgo(0),
    },
  ];

  const created: Record<string, any> = {};

  for (const e of entries) {
    const vehicleId = vMap[e.vehicleImmat]?.id;
    if (!vehicleId) {
      console.warn(`Vehicle not found: ${e.vehicleImmat}, skipping ${e.ref}`);
      continue;
    }

    const record = await prisma.lgCarburant.create({
      data: {
        reference: e.ref,
        status: e.status,
        vehicleId,
        typeCarburant: e.typeCarburant,
        volumeLitres: e.volumeLitres,
        ...(e.prixUnitaire != null ? { prixUnitaire: e.prixUnitaire } : {}),
        montantTotal: e.montantTotal,
        ...(e.kilometrage != null ? { kilometrage: e.kilometrage } : {}),
        ...(e.station ? { station: e.station } : {}),
        ...(e.notes ? { notes: e.notes } : {}),
        dateApprovisionnement: e.dateApprovisionnement,
        requestorId: userMap[e.requestorKey].id,
        createdAt: e.createdAt,
        updatedAt: e.createdAt,
      },
    });

    created[e.ref] = record;
  }

  const comments = [
    {
      ref: `CAR-${year}-0001`,
      authorKey: 'admin',
      content: 'Reçu. En cours de vérification avec le bon de carburant.',
      createdAt: daysAgo(0),
    },
    {
      ref: `CAR-${year}-0002`,
      authorKey: 'demandeur2',
      content:
        'Ticket de caisse joint en pièce jointe dans le dossier mission.',
      createdAt: daysAgo(2),
    },
    {
      ref: `CAR-${year}-0002`,
      authorKey: 'admin',
      content: 'Ticket bien reçu. Traitement en cours.',
      createdAt: daysAgo(1),
    },
    {
      ref: `CAR-${year}-0004`,
      authorKey: 'admin',
      content: 'Dossier traité. Montant validé et enregistré en comptabilité.',
      createdAt: daysAgo(8),
    },
    {
      ref: `CAR-${year}-0004`,
      authorKey: 'demandeur2',
      content: 'Merci pour la confirmation rapide.',
      createdAt: daysAgo(7),
    },
    {
      ref: `CAR-${year}-0005`,
      authorKey: 'admin',
      content:
        'Approvisionnement validé. Kilométrage cohérent avec le suivi parc.',
      createdAt: daysAgo(13),
    },
    {
      ref: `CAR-${year}-0007`,
      authorKey: 'demandeur1',
      content: "Double saisie détectée. J'annule cet enregistrement.",
      createdAt: daysAgo(8),
    },
    {
      ref: `CAR-${year}-0008`,
      authorKey: 'admin',
      content:
        'Ce véhicule fonctionne au gasoil. Entrée annulée — merci de resaisir avec le bon type de carburant.',
      createdAt: daysAgo(11),
    },
    {
      ref: `CAR-${year}-0008`,
      authorKey: 'demandeur2',
      content: 'Compris, je vais créer une nouvelle entrée corrigée.',
      createdAt: daysAgo(11),
    },
    {
      ref: `CAR-${year}-0009`,
      authorKey: 'admin',
      content: 'Traité. Rapport de mission reçu et classé.',
      createdAt: daysAgo(28),
    },
  ];

  for (const c of comments) {
    const carburant = created[c.ref];
    if (!carburant) continue;

    await prisma.lgCarburantComment.create({
      data: {
        carburantId: carburant.id,
        authorId: userMap[c.authorKey].id,
        content: c.content,
        createdAt: c.createdAt,
        updatedAt: c.createdAt,
      },
    });
  }

  const pending = entries.filter(
    (e) => e.status === LgCarburantStatus.PENDING,
  ).length;
  const processed = entries.filter(
    (e) => e.status === LgCarburantStatus.PROCESSED,
  ).length;
  const cancelled = entries.filter(
    (e) => e.status === LgCarburantStatus.CANCELLED,
  ).length;

  console.log(
    `Carburant: ${entries.length} approvisionnements (${pending} PENDING | ${processed} PROCESSED | ${cancelled} CANCELLED) | ${comments.length} commentaires`,
  );
}
