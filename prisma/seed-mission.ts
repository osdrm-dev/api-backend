import { PrismaClient, LgMissionStatus, LgMissionType } from '@prisma/client';

const today = new Date();
const daysFromNow = (n: number) => new Date(today.getTime() + n * 86_400_000);
const year = today.getFullYear();

export async function seedMission(
  prisma: PrismaClient,
  userMap: Record<string, any>,
) {
  await prisma.lgMissionSettlement.deleteMany();
  await prisma.lgMissionComment.deleteMany();
  await prisma.lgMission.deleteMany();

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

  // 1. PENDING — Pierre Andry, supervision Fianarantsoa
  await prisma.lgMission.create({
    data: {
      reference: `TRJ-${year}-0001`,
      purpose: 'Supervision terrain programme nutrition',
      destination: 'Fianarantsoa',
      departureDate: daysFromNow(7),
      returnDate: daysFromNow(10),
      missionType: LgMissionType.NATIONAL,
      passengerCount: 2,
      passengers: ['Rakoto Jean'],
      justification:
        "Évaluation à mi-parcours du programme nutrition district Amoron'i Mania.",
      status: LgMissionStatus.PENDING,
      requestor: { connect: { id: d1.id } },
    },
  });

  // 2. VEHICLE_ASSIGNED — Julie Fara, réunion Toamasina
  const mission2 = await prisma.lgMission.create({
    data: {
      reference: `TRJ-${year}-0002`,
      purpose: 'Réunion de coordination partenaires UNICEF',
      destination: 'Toamasina',
      departureDate: daysFromNow(5),
      returnDate: daysFromNow(7),
      missionType: LgMissionType.NATIONAL,
      passengerCount: 1,
      status: LgMissionStatus.VEHICLE_ASSIGNED,
      requestor: { connect: { id: d2.id } },
      manager: { connect: { id: gp.id } },
      ...(v1 && { vehicle: { connect: { id: v1.id } } }),
    },
  });

  await prisma.lgMissionComment.create({
    data: {
      missionId: mission2.id,
      authorId: gp.id,
      content:
        'Véhicule 1234 TAA 101 attribué. Départ prévu à 06h00 depuis le siège.',
    },
  });

  // 3. CONFIRMED — Pierre Andry, formation Mahajanga
  await prisma.lgMission.create({
    data: {
      reference: `TRJ-${year}-0003`,
      purpose: 'Formation équipe régionale — outils MEAL',
      destination: 'Mahajanga',
      departureDate: daysFromNow(3),
      returnDate: daysFromNow(6),
      missionType: LgMissionType.NATIONAL,
      passengerCount: 3,
      passengers: ['Marie Rasoa', 'Lucie Ralambanirina'],
      perDiemAmount: '85000.00',
      additionalInstructions:
        "Hébergement à l'Hôtel de la Mer. Carburant à récupérer au magasin avant départ.",
      confirmedAt: daysFromNow(-1),
      status: LgMissionStatus.CONFIRMED,
      requestor: { connect: { id: d1.id } },
      manager: { connect: { id: gp.id } },
      ...(v2 && { vehicle: { connect: { id: v2.id } } }),
    },
  });

  // 4. IN_PROGRESS — Julie Fara, mission terrain Tuléar
  const mission4 = await prisma.lgMission.create({
    data: {
      reference: `TRJ-${year}-0004`,
      purpose: 'Suivi activités terrain — District Atsimo-Andrefana',
      destination: 'Tuléar',
      departureDate: daysFromNow(-2),
      returnDate: daysFromNow(1),
      missionType: LgMissionType.NATIONAL,
      passengerCount: 2,
      passengers: ['Paul Ravelo'],
      perDiemAmount: '90000.00',
      confirmedAt: daysFromNow(-5),
      status: LgMissionStatus.IN_PROGRESS,
      requestor: { connect: { id: d2.id } },
      manager: { connect: { id: gp.id } },
    },
  });

  await prisma.lgMissionComment.create({
    data: {
      missionId: mission4.id,
      authorId: d2.id,
      content:
        'Mission démarrée. Arrivée à Tuléar à 14h30, hébergement confirmé.',
    },
  });

  // 5. SETTLED — Pierre Andry, audit WASH Antsiranana (clôturée)
  await prisma.lgMission.create({
    data: {
      reference: `TRJ-${year}-0005`,
      purpose: 'Audit interne programme WASH — région DIANA',
      destination: 'Antsiranana',
      departureDate: daysFromNow(-20),
      returnDate: daysFromNow(-16),
      missionType: LgMissionType.NATIONAL,
      passengerCount: 2,
      passengers: ['Marc Rivo'],
      perDiemAmount: '90000.00',
      confirmedAt: daysFromNow(-25),
      status: LgMissionStatus.SETTLED,
      requestor: { connect: { id: d1.id } },
      manager: { connect: { id: gp.id } },
      settlement: {
        create: {
          transportCost: '120000.00',
          accommodationCost: '180000.00',
          mealCost: '60000.00',
          otherCosts: '15000.00',
          totalAmount: '375000.00',
          remarks:
            'Dépenses conformes au budget prévisionnel. Un taxi supplémentaire pris pour retour tardif.',
          submittedById: d1.id,
        },
      },
    },
  });

  // 6. REJECTED — Julie Fara, pas de véhicule disponible
  await prisma.lgMission.create({
    data: {
      reference: `TRJ-${year}-0006`,
      purpose: "Atelier régional sur la protection de l'enfance",
      destination: 'Morondava',
      departureDate: daysFromNow(14),
      returnDate: daysFromNow(16),
      missionType: LgMissionType.NATIONAL,
      passengerCount: 1,
      status: LgMissionStatus.REJECTED,
      rejectionReason:
        'Aucun véhicule disponible pour cette période. Merci de reporter la mission à la semaine suivante.',
      requestor: { connect: { id: d2.id } },
      manager: { connect: { id: gp.id } },
    },
  });

  // 7. CANCELLED — Pierre Andry, visite annulée
  await prisma.lgMission.create({
    data: {
      reference: `TRJ-${year}-0007`,
      purpose: 'Visite de courtoisie — Partenaire CARE',
      destination: 'Tamatave',
      departureDate: daysFromNow(-5),
      returnDate: daysFromNow(-3),
      missionType: LgMissionType.NATIONAL,
      passengerCount: 1,
      status: LgMissionStatus.CANCELLED,
      requestor: { connect: { id: d1.id } },
    },
  });

  // 8. PENDING_RENTAL — Julie Fara, conférence internationale Nairobi
  const mission8 = await prisma.lgMission.create({
    data: {
      reference: `TRJ-${year}-0008`,
      purpose: 'Conférence régionale INGO — East Africa Nutrition Summit',
      destination: 'Nairobi, Kenya',
      departureDate: daysFromNow(21),
      returnDate: daysFromNow(26),
      missionType: LgMissionType.INTERNATIONAL,
      passengerCount: 1,
      justification:
        "Représentation OSDRM à la conférence régionale sur la nutrition en Afrique de l'Est. Invitation formelle reçue.",
      status: LgMissionStatus.PENDING_RENTAL,
      requestor: { connect: { id: d2.id } },
      manager: { connect: { id: gp.id } },
    },
  });

  await prisma.lgMissionComment.create({
    data: {
      missionId: mission8.id,
      authorId: gp.id,
      content:
        'Mission internationale — DA en cours de traitement pour le vol et hébergement.',
    },
  });

  console.log(
    `Trajets: 8 dossiers | PENDING ×1 | VEHICLE_ASSIGNED ×1 | CONFIRMED ×1 | IN_PROGRESS ×1 | SETTLED ×1 | REJECTED ×1 | CANCELLED ×1 | PENDING_RENTAL ×1 | commentaires ×3`,
  );
}
