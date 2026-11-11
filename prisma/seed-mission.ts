import {
  PrismaClient,
  LgMissionStatus,
  LgMissionType,
  LgSettlementValidationStatus as VStatus,
  LgSettlementValidatorRole as VRole,
} from '@prisma/client';

const today = new Date();
const daysFromNow = (n: number) => new Date(today.getTime() + n * 86_400_000);
const year = today.getFullYear();

export async function seedMission(
  prisma: PrismaClient,
  userMap: Record<string, any>,
) {
  await prisma.lgSettlementValidation.deleteMany();
  await prisma.lgMissionSettlement.deleteMany();
  await prisma.lgMissionComment.deleteMany();
  await prisma.lgMission.deleteMany();

  const gp = userMap['gp'];
  const d1 = userMap['demandeur1'];
  const d2 = userMap['demandeur2'];
  const om = userMap['om'];
  const cfo = userMap['cfo'];

  // Liquidation + 3 validations parallèles (DEMANDEUR/OM/CFO).
  // SETTLED = aucune décision ou décisions partielles sans rejet ;
  // SETTLEMENT_APPROVED = 3 APPROVED ; SETTLEMENT_REJECTED = >=1 REJECTED commenté.
  type Decision = [VStatus, string | undefined, number]; // statut, commentaire, décalage en jours
  const settlementFor = (
    requestor: any,
    costs: [number, number, number, number],
    remarks: string,
    submittedOffset: number,
    decisions: Partial<Record<VRole, Decision>>,
  ) => {
    const [transport, lodging, meals, other] = costs;
    const validators: Record<VRole, any> = {
      DEMANDEUR: requestor,
      OM: om,
      CFO: cfo,
    };
    return {
      create: {
        transportCost: transport.toFixed(2),
        accommodationCost: lodging.toFixed(2),
        mealCost: meals.toFixed(2),
        otherCosts: other.toFixed(2),
        totalAmount: (transport + lodging + meals + other).toFixed(2),
        remarks,
        submittedAt: daysFromNow(submittedOffset),
        submittedById: requestor.id,
        validations: {
          create: [VRole.DEMANDEUR, VRole.OM, VRole.CFO].map((role) => {
            const d = decisions[role];
            return d
              ? {
                  role,
                  status: d[0],
                  comment: d[1],
                  validatorId: validators[role].id,
                  decidedAt: daysFromNow(d[2]),
                }
              : { role, status: VStatus.PENDING };
          }),
        },
      },
    };
  };

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
      settlement: settlementFor(
        d1,
        [120000, 180000, 60000, 15000],
        'Dépenses conformes au budget prévisionnel. Un taxi supplémentaire pris pour retour tardif.',
        -15,
        {},
      ),
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

  // 9. CONFIRMED — Pierre Andry, supervision Antsirabe (reçoit des déplacements)
  await prisma.lgMission.create({
    data: {
      reference: `TRJ-${year}-0009`,
      purpose: 'Supervision des centres de santé communautaires',
      destination: 'Antsirabe',
      departureDate: daysFromNow(2),
      returnDate: daysFromNow(4),
      missionType: LgMissionType.REGIONAL,
      passengerCount: 2,
      passengers: ['Hanta Rasolofo'],
      perDiemAmount: '70000.00',
      confirmedAt: daysFromNow(-2),
      status: LgMissionStatus.CONFIRMED,
      requestor: { connect: { id: d1.id } },
      manager: { connect: { id: gp.id } },
      ...(v1 && { vehicle: { connect: { id: v1.id } } }),
    },
  });

  // 10. IN_PROGRESS — Pierre Andry, Morondava
  await prisma.lgMission.create({
    data: {
      reference: `TRJ-${year}-0010`,
      purpose: 'Distribution de kits agricoles — district Morondava',
      destination: 'Morondava',
      departureDate: daysFromNow(-3),
      returnDate: daysFromNow(2),
      missionType: LgMissionType.REGIONAL,
      passengerCount: 3,
      passengers: ['Tiana Randrianarisoa', 'Mino Rabe'],
      perDiemAmount: '85000.00',
      confirmedAt: daysFromNow(-6),
      status: LgMissionStatus.IN_PROGRESS,
      requestor: { connect: { id: d1.id } },
      manager: { connect: { id: gp.id } },
    },
  });

  // 11. SETTLEMENT_APPROVED — Julie Fara, Mahajanga (3 validations APPROVED)
  await prisma.lgMission.create({
    data: {
      reference: `TRJ-${year}-0011`,
      purpose: 'Atelier de planification annuelle — bureau régional Boeny',
      destination: 'Mahajanga',
      departureDate: daysFromNow(-45),
      returnDate: daysFromNow(-42),
      missionType: LgMissionType.NATIONAL,
      passengerCount: 2,
      passengers: ['Soa Razafy'],
      perDiemAmount: '85000.00',
      confirmedAt: daysFromNow(-50),
      status: LgMissionStatus.SETTLEMENT_APPROVED,
      requestor: { connect: { id: d2.id } },
      manager: { connect: { id: gp.id } },
      settlement: settlementFor(
        d2,
        [95000, 160000, 55000, 0],
        'Frais conformes, justificatifs joints.',
        -41,
        {
          DEMANDEUR: [VStatus.APPROVED, 'Je confirme les montants.', -41],
          OM: [VStatus.APPROVED, 'Validé OM.', -40],
          CFO: [VStatus.APPROVED, 'Budget conforme, paiement autorisé.', -38],
        },
      ),
    },
  });

  // 12. SETTLEMENT_REJECTED — Pierre Andry, Fianarantsoa (CFO rejette)
  await prisma.lgMission.create({
    data: {
      reference: `TRJ-${year}-0012`,
      purpose: 'Revue trimestrielle des partenaires — Haute Matsiatra',
      destination: 'Fianarantsoa',
      departureDate: daysFromNow(-30),
      returnDate: daysFromNow(-27),
      missionType: LgMissionType.NATIONAL,
      passengerCount: 1,
      perDiemAmount: '80000.00',
      confirmedAt: daysFromNow(-34),
      status: LgMissionStatus.SETTLEMENT_REJECTED,
      requestor: { connect: { id: d1.id } },
      manager: { connect: { id: gp.id } },
      settlement: settlementFor(
        d1,
        [110000, 210000, 75000, 90000],
        'Autres frais : réparation pneu et frais de pont.',
        -26,
        {
          DEMANDEUR: [VStatus.APPROVED, undefined, -26],
          OM: [VStatus.APPROVED, 'OK sur le principe.', -25],
          CFO: [
            VStatus.REJECTED,
            'Justificatifs manquants pour les « autres frais » (90 000 Ar). Merci de compléter et resoumettre.',
            -24,
          ],
        },
      ),
    },
  });

  // 13. SETTLED — Julie Fara, Toliara (validation en cours : DEMANDEUR + OM décidés)
  await prisma.lgMission.create({
    data: {
      reference: `TRJ-${year}-0013`,
      purpose: 'Suivi des activités de nutrition — Atsimo-Andrefana',
      destination: 'Toliara',
      departureDate: daysFromNow(-12),
      returnDate: daysFromNow(-9),
      missionType: LgMissionType.NATIONAL,
      passengerCount: 2,
      passengers: ['Paul Ravelo'],
      perDiemAmount: '90000.00',
      confirmedAt: daysFromNow(-16),
      status: LgMissionStatus.SETTLED,
      requestor: { connect: { id: d2.id } },
      manager: { connect: { id: gp.id } },
      settlement: settlementFor(
        d2,
        [130000, 190000, 70000, 10000],
        'Liquidation soumise après retour.',
        -8,
        {
          DEMANDEUR: [VStatus.APPROVED, 'Montants exacts.', -8],
          OM: [VStatus.APPROVED, undefined, -7],
        },
      ),
    },
  });

  console.log(
    `Trajets: 13 dossiers | PENDING ×1 | VEHICLE_ASSIGNED ×1 | PENDING_RENTAL ×1 | CONFIRMED ×2 | IN_PROGRESS ×2 | SETTLED ×2 | SETTLEMENT_APPROVED ×1 | SETTLEMENT_REJECTED ×1 | REJECTED ×1 | CANCELLED ×1 | liquidations ×4 (12 validations) | commentaires ×3`,
  );
}
