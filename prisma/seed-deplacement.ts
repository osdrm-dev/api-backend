import {
  PrismaClient,
  LgDeplacementStatus,
  LgTypeMission,
} from '@prisma/client';

const today = new Date();
const daysFromNow = (n: number) => new Date(today.getTime() + n * 86_400_000);
const year = today.getFullYear();

export async function seedDeplacement(
  prisma: PrismaClient,
  userMap: Record<string, any>,
) {
  await prisma.lgDeplacementLiquidation.deleteMany();
  await prisma.lgDeplacementComment.deleteMany();
  await prisma.lgDeplacement.deleteMany();

  const gp = userMap['gp'];
  const d1 = userMap['demandeur1'];
  const d2 = userMap['demandeur2'];

  const vehicles = await prisma.vehicle.findMany({
    where: { statut: 'ACTIF' },
    take: 2,
    orderBy: { createdAt: 'asc' },
  });
  const v1 = vehicles[0] ?? null;
  const v2 = vehicles[1] ?? null;

  // 1. EN_ATTENTE — Pierre Andry, supervision Fianarantsoa
  await prisma.lgDeplacement.create({
    data: {
      reference: `DEP-${year}-0001`,
      objet: 'Supervision terrain programme nutrition',
      destination: 'Fianarantsoa',
      dateDepart: daysFromNow(7),
      dateRetour: daysFromNow(10),
      typeMission: LgTypeMission.DEPLACEMENT_NATIONAL,
      nombrePersonnes: 2,
      passagers: ['Rakoto Jean'],
      justification:
        "Évaluation à mi-parcours du programme nutrition district Amoron'i Mania.",
      status: LgDeplacementStatus.EN_ATTENTE,
      requestor: { connect: { id: d1.id } },
    },
  });

  // 2. VEHICULE_ATTRIBUE — Julie Fara, réunion Toamasina
  const dep2 = await prisma.lgDeplacement.create({
    data: {
      reference: `DEP-${year}-0002`,
      objet: 'Réunion de coordination partenaires UNICEF',
      destination: 'Toamasina',
      dateDepart: daysFromNow(5),
      dateRetour: daysFromNow(7),
      typeMission: LgTypeMission.DEPLACEMENT_NATIONAL,
      nombrePersonnes: 1,
      status: LgDeplacementStatus.VEHICULE_ATTRIBUE,
      requestor: { connect: { id: d2.id } },
      gestionnaire: { connect: { id: gp.id } },
      ...(v1 && { vehicle: { connect: { id: v1.id } } }),
    },
  });

  await prisma.lgDeplacementComment.create({
    data: {
      deplacementId: dep2.id,
      authorId: gp.id,
      content:
        'Véhicule 1234 TAA 101 attribué. Départ prévu à 06h00 depuis le siège.',
    },
  });

  // 3. CONFIRMEE — Pierre Andry, formation Mahajanga
  await prisma.lgDeplacement.create({
    data: {
      reference: `DEP-${year}-0003`,
      objet: 'Formation équipe régionale — outils MEAL',
      destination: 'Mahajanga',
      dateDepart: daysFromNow(3),
      dateRetour: daysFromNow(6),
      typeMission: LgTypeMission.DEPLACEMENT_NATIONAL,
      nombrePersonnes: 3,
      passagers: ['Marie Rasoa', 'Lucie Ralambanirina'],
      montantPerDiem: '85000.00',
      instructionsComplementaires:
        "Hébergement à l'Hôtel de la Mer. Carburant à récupérer au magasin avant départ.",
      confirmedAt: daysFromNow(-1),
      status: LgDeplacementStatus.CONFIRMEE,
      requestor: { connect: { id: d1.id } },
      gestionnaire: { connect: { id: gp.id } },
      ...(v2 && { vehicle: { connect: { id: v2.id } } }),
    },
  });

  // 4. EN_COURS — Julie Fara, mission terrain Tuléar
  const dep4 = await prisma.lgDeplacement.create({
    data: {
      reference: `DEP-${year}-0004`,
      objet: 'Suivi activités terrain — District Atsimo-Andrefana',
      destination: 'Tuléar',
      dateDepart: daysFromNow(-2),
      dateRetour: daysFromNow(1),
      typeMission: LgTypeMission.DEPLACEMENT_NATIONAL,
      nombrePersonnes: 2,
      passagers: ['Paul Ravelo'],
      montantPerDiem: '90000.00',
      confirmedAt: daysFromNow(-5),
      status: LgDeplacementStatus.EN_COURS,
      requestor: { connect: { id: d2.id } },
      gestionnaire: { connect: { id: gp.id } },
    },
  });

  await prisma.lgDeplacementComment.create({
    data: {
      deplacementId: dep4.id,
      authorId: d2.id,
      content:
        'Mission démarrée. Arrivée à Tuléar à 14h30, hébergement confirmé.',
    },
  });

  // 5. LIQUIDEE — Pierre Andry, audit WASH Antsiranana (clôturée)
  await prisma.lgDeplacement.create({
    data: {
      reference: `DEP-${year}-0005`,
      objet: 'Audit interne programme WASH — région DIANA',
      destination: 'Antsiranana',
      dateDepart: daysFromNow(-20),
      dateRetour: daysFromNow(-16),
      typeMission: LgTypeMission.DEPLACEMENT_NATIONAL,
      nombrePersonnes: 2,
      passagers: ['Marc Rivo'],
      montantPerDiem: '90000.00',
      confirmedAt: daysFromNow(-25),
      status: LgDeplacementStatus.LIQUIDEE,
      requestor: { connect: { id: d1.id } },
      gestionnaire: { connect: { id: gp.id } },
      liquidation: {
        create: {
          fraisTransport: '120000.00',
          fraisHebergement: '180000.00',
          fraisRestauration: '60000.00',
          autresFrais: '15000.00',
          totalLiquidation: '375000.00',
          observations:
            'Dépenses conformes au budget prévisionnel. Un taxi supplémentaire pris pour retour tardif.',
          submittedById: d1.id,
        },
      },
    },
  });

  // 6. REFUSEE — Julie Fara, pas de véhicule disponible
  await prisma.lgDeplacement.create({
    data: {
      reference: `DEP-${year}-0006`,
      objet: "Atelier régional sur la protection de l'enfance",
      destination: 'Morondava',
      dateDepart: daysFromNow(14),
      dateRetour: daysFromNow(16),
      typeMission: LgTypeMission.DEPLACEMENT_NATIONAL,
      nombrePersonnes: 1,
      status: LgDeplacementStatus.REFUSEE,
      motifRefus:
        'Aucun véhicule disponible pour cette période. Merci de reporter la mission à la semaine suivante.',
      requestor: { connect: { id: d2.id } },
      gestionnaire: { connect: { id: gp.id } },
    },
  });

  // 7. ANNULEE — Pierre Andry, visite annulée
  await prisma.lgDeplacement.create({
    data: {
      reference: `DEP-${year}-0007`,
      objet: 'Visite de courtoisie — Partenaire CARE',
      destination: 'Tamatave',
      dateDepart: daysFromNow(-5),
      dateRetour: daysFromNow(-3),
      typeMission: LgTypeMission.DEPLACEMENT_NATIONAL,
      nombrePersonnes: 1,
      status: LgDeplacementStatus.ANNULEE,
      requestor: { connect: { id: d1.id } },
    },
  });

  // 8. EN_ATTENTE_LOCATION — Julie Fara, conférence internationale Nairobi
  const dep8 = await prisma.lgDeplacement.create({
    data: {
      reference: `DEP-${year}-0008`,
      objet: 'Conférence régionale INGO — East Africa Nutrition Summit',
      destination: 'Nairobi, Kenya',
      dateDepart: daysFromNow(21),
      dateRetour: daysFromNow(26),
      typeMission: LgTypeMission.DEPLACEMENT_INTERNATIONAL,
      nombrePersonnes: 1,
      justification:
        "Représentation OSDRM à la conférence régionale sur la nutrition en Afrique de l'Est. Invitation formelle reçue.",
      status: LgDeplacementStatus.EN_ATTENTE_LOCATION,
      requestor: { connect: { id: d2.id } },
      gestionnaire: { connect: { id: gp.id } },
    },
  });

  await prisma.lgDeplacementComment.create({
    data: {
      deplacementId: dep8.id,
      authorId: gp.id,
      content:
        'Mission internationale — DA en cours de traitement pour le vol et hébergement.',
    },
  });

  console.log(
    `Déplacements: 8 dossiers | EN_ATTENTE ×1 | VEHICULE_ATTRIBUE ×1 | CONFIRMEE ×1 | EN_COURS ×1 | LIQUIDEE ×1 | REFUSEE ×1 | ANNULEE ×1 | EN_ATTENTE_LOCATION ×1 | commentaires ×3`,
  );
}
