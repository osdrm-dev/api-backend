import {
  PrismaClient,
  VehicleStatut,
  VehicleDocumentType,
} from '@prisma/client';

const today = new Date();
const daysFromNow = (n: number) => new Date(today.getTime() + n * 86_400_000);

export async function seedParcAuto(prisma: PrismaClient) {
  await prisma.vehicleAlertLog.deleteMany();
  await prisma.vehicleDocument.deleteMany();
  await prisma.vehicle.deleteMany();

  // Vehicle 1: all docs valid
  const v1 = await prisma.vehicle.create({
    data: {
      immatriculation: '1234 TAA 101',
      marque: 'Toyota',
      modele: 'Hilux',
      annee: 2021,
      statut: VehicleStatut.ACTIF,
    },
  });
  await prisma.vehicleDocument.createMany({
    data: [
      {
        vehicleId: v1.id,
        type: VehicleDocumentType.ASSURANCE,
        reference: 'POL-2024-001',
        dateDebut: daysFromNow(-365),
        dateExpiration: daysFromNow(180),
        isActive: true,
      },
      {
        vehicleId: v1.id,
        type: VehicleDocumentType.VISITE_TECHNIQUE,
        reference: 'VT-2024-001',
        dateDebut: daysFromNow(-180),
        dateExpiration: daysFromNow(90),
        isActive: true,
      },
      {
        vehicleId: v1.id,
        type: VehicleDocumentType.CARTE_GRISE,
        reference: 'CG-101-TAA',
        dateDebut: daysFromNow(-730),
        dateExpiration: daysFromNow(365),
        isActive: true,
      },
    ],
  });

  // Vehicle 2: assurance expires in 7 days
  const v2 = await prisma.vehicle.create({
    data: {
      immatriculation: '5678 TAA 202',
      marque: 'Toyota',
      modele: 'Land Cruiser',
      annee: 2019,
      statut: VehicleStatut.ACTIF,
    },
  });
  await prisma.vehicleDocument.createMany({
    data: [
      {
        vehicleId: v2.id,
        type: VehicleDocumentType.ASSURANCE,
        reference: 'POL-2024-002',
        dateDebut: daysFromNow(-358),
        dateExpiration: daysFromNow(7),
        isActive: true,
      },
      {
        vehicleId: v2.id,
        type: VehicleDocumentType.VISITE_TECHNIQUE,
        reference: 'VT-2024-002',
        dateDebut: daysFromNow(-90),
        dateExpiration: daysFromNow(120),
        isActive: true,
      },
      {
        vehicleId: v2.id,
        type: VehicleDocumentType.CARTE_GRISE,
        reference: 'CG-202-TAA',
        dateDebut: daysFromNow(-500),
        dateExpiration: daysFromNow(500),
        isActive: true,
      },
    ],
  });

  // Vehicle 3: visite technique expires in 15 days, carte grise expired
  const v3 = await prisma.vehicle.create({
    data: {
      immatriculation: '9012 TAB 303',
      marque: 'Mitsubishi',
      modele: 'L200',
      annee: 2022,
      statut: VehicleStatut.ACTIF,
    },
  });
  await prisma.vehicleDocument.createMany({
    data: [
      {
        vehicleId: v3.id,
        type: VehicleDocumentType.ASSURANCE,
        reference: 'POL-2025-003',
        dateDebut: daysFromNow(-30),
        dateExpiration: daysFromNow(335),
        isActive: true,
      },
      {
        vehicleId: v3.id,
        type: VehicleDocumentType.VISITE_TECHNIQUE,
        reference: 'VT-2024-003',
        dateDebut: daysFromNow(-350),
        dateExpiration: daysFromNow(15),
        isActive: true,
      },
      {
        vehicleId: v3.id,
        type: VehicleDocumentType.CARTE_GRISE,
        reference: 'CG-303-TAB',
        dateDebut: daysFromNow(-730),
        dateExpiration: daysFromNow(-10),
        isActive: true,
      },
    ],
  });

  // Vehicle 4: all docs expired
  const v4 = await prisma.vehicle.create({
    data: {
      immatriculation: '3456 TAC 404',
      marque: 'Nissan',
      modele: 'Navara',
      annee: 2020,
      statut: VehicleStatut.ACTIF,
    },
  });
  await prisma.vehicleDocument.createMany({
    data: [
      {
        vehicleId: v4.id,
        type: VehicleDocumentType.ASSURANCE,
        reference: 'POL-2023-004',
        dateDebut: daysFromNow(-400),
        dateExpiration: daysFromNow(-35),
        isActive: true,
      },
      {
        vehicleId: v4.id,
        type: VehicleDocumentType.VISITE_TECHNIQUE,
        reference: 'VT-2023-004',
        dateDebut: daysFromNow(-400),
        dateExpiration: daysFromNow(-60),
        isActive: true,
      },
      {
        vehicleId: v4.id,
        type: VehicleDocumentType.CARTE_GRISE,
        reference: 'CG-404-TAC',
        dateDebut: daysFromNow(-730),
        dateExpiration: daysFromNow(-5),
        isActive: true,
      },
    ],
  });

  // Vehicle 5: assurance expiring in 30 days, no carte grise (INCOMPLET)
  const v5 = await prisma.vehicle.create({
    data: {
      immatriculation: '7890 TAD 505',
      marque: 'Ford',
      modele: 'Ranger',
      annee: 2023,
      statut: VehicleStatut.ACTIF,
    },
  });
  await prisma.vehicleDocument.createMany({
    data: [
      {
        vehicleId: v5.id,
        type: VehicleDocumentType.ASSURANCE,
        reference: 'POL-2025-005',
        dateDebut: daysFromNow(-335),
        dateExpiration: daysFromNow(30),
        isActive: true,
      },
      {
        vehicleId: v5.id,
        type: VehicleDocumentType.VISITE_TECHNIQUE,
        reference: 'VT-2025-005',
        dateDebut: daysFromNow(-60),
        dateExpiration: daysFromNow(300),
        isActive: true,
      },
    ],
  });

  // Vehicle 6: no documents (INCOMPLET)
  await prisma.vehicle.create({
    data: {
      immatriculation: '2468 TAE 606',
      marque: 'Toyota',
      modele: 'RAV4',
      annee: 2024,
      statut: VehicleStatut.ACTIF,
    },
  });

  // Vehicle 7: archived with expired docs
  const v7 = await prisma.vehicle.create({
    data: {
      immatriculation: '1357 TAF 707',
      marque: 'Isuzu',
      modele: 'D-Max',
      annee: 2017,
      statut: VehicleStatut.ARCHIVE,
    },
  });
  await prisma.vehicleDocument.createMany({
    data: [
      {
        vehicleId: v7.id,
        type: VehicleDocumentType.ASSURANCE,
        reference: 'POL-2022-007',
        dateDebut: daysFromNow(-700),
        dateExpiration: daysFromNow(-100),
        isActive: true,
      },
      {
        vehicleId: v7.id,
        type: VehicleDocumentType.VISITE_TECHNIQUE,
        reference: 'VT-2022-007',
        dateDebut: daysFromNow(-700),
        dateExpiration: daysFromNow(-200),
        isActive: true,
      },
    ],
  });

  // Vehicle 8: superseded assurance history + all docs valid
  const v8 = await prisma.vehicle.create({
    data: {
      immatriculation: '8024 TAG 808',
      marque: 'Isuzu',
      modele: 'MU-X',
      annee: 2021,
      statut: VehicleStatut.ACTIF,
    },
  });
  await prisma.vehicleDocument.create({
    data: {
      vehicleId: v8.id,
      type: VehicleDocumentType.ASSURANCE,
      reference: 'POL-2023-008-OLD',
      dateDebut: daysFromNow(-730),
      dateExpiration: daysFromNow(-5),
      isActive: false,
    },
  });
  await prisma.vehicleDocument.create({
    data: {
      vehicleId: v8.id,
      type: VehicleDocumentType.ASSURANCE,
      reference: 'POL-2025-008',
      dateDebut: daysFromNow(-5),
      dateExpiration: daysFromNow(360),
      isActive: true,
    },
  });
  await prisma.vehicleDocument.createMany({
    data: [
      {
        vehicleId: v8.id,
        type: VehicleDocumentType.VISITE_TECHNIQUE,
        reference: 'VT-2025-008',
        dateDebut: daysFromNow(-60),
        dateExpiration: daysFromNow(305),
        isActive: true,
      },
      {
        vehicleId: v8.id,
        type: VehicleDocumentType.CARTE_GRISE,
        reference: 'CG-808-TAG',
        dateDebut: daysFromNow(-730),
        dateExpiration: daysFromNow(270),
        isActive: true,
      },
    ],
  });

  console.log(
    'Parc Auto: 8 véhicules | valide / bientôt expiré / expiré / incomplet / archivé / historique',
  );
}
