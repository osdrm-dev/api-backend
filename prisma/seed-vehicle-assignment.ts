import { PrismaClient, Role, VehicleAssignmentStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const today = new Date();
const daysAgo = (n: number) => new Date(today.getTime() - n * 86_400_000);

// Règle métier : un véhicule ↔ un chauffeur ACTIVE à la fois (des deux côtés),
// les affectations terminées ne se chevauchent pas. Pièce jointe (fileId) non seedée.
export async function seedVehicleAssignment(
  prisma: PrismaClient,
  userMap: Record<string, any>,
) {
  await prisma.lgVehicleAssignment.deleteMany();

  const pwd = await bcrypt.hash('Password123!', 10);
  const driversData = [
    ['driver1', 'driver1@osdrm.mg', 'Rakoto Jean', 'Chauffeur'],
    ['driver2', 'driver2@osdrm.mg', 'Randria Hery', 'Chauffeur'],
    ['driver3', 'driver3@osdrm.mg', 'Rabe Solo', 'Chauffeur'],
    ['driver4', 'driver4@osdrm.mg', 'Andry Faly', 'Chauffeur'],
  ];
  for (const [key, email, name, fonction] of driversData) {
    userMap[key] = await prisma.user.create({
      data: { email, password: pwd, name, fonction, role: Role.DRIVER },
    });
  }

  const vehicle = (immatriculation: string) =>
    prisma.vehicle.findFirstOrThrow({ where: { immatriculation } });
  const [v1, v2, v3, v4, v5] = await Promise.all(
    [
      '1234 TAA 101',
      '5678 TAA 202',
      '9012 TAB 303',
      '3456 TAC 404',
      '7890 TAD 505',
    ].map(vehicle),
  );
  const adminId = userMap['admin'].id;

  const rows = [
    // ACTIVE : driver1→v1, driver2→v2, driver3→v3 (driver4 sans véhicule)
    [
      v1,
      'driver1',
      120,
      null,
      'Affectation permanente — véhicule de direction.',
    ],
    [v2, 'driver2', 60, null, 'Véhicule 4x4 pour les missions terrain.'],
    [v3, 'driver3', 15, null, 'Reprise du véhicule après entretien.'],
    // TERMINEE : historique sans chevauchement
    [
      v5,
      'driver1',
      400,
      120,
      'Ancienne affectation, remplacée par la direction.',
    ],
    [
      v4,
      'driver3',
      200,
      15,
      'Fin d’affectation : véhicule en révision longue.',
    ],
    [v3, 'driver4', 300, 15, 'Chauffeur réaffecté au pool logistique.'],
  ] as const;

  for (const [vehicleRow, driverKey, startAgo, endAgo, notes] of rows) {
    await prisma.lgVehicleAssignment.create({
      data: {
        vehicleId: vehicleRow.id,
        driverId: userMap[driverKey].id,
        startDate: daysAgo(startAgo),
        endDate: endAgo === null ? null : daysAgo(endAgo),
        status:
          endAgo === null
            ? VehicleAssignmentStatus.ACTIVE
            : VehicleAssignmentStatus.TERMINEE,
        notes,
        createdById: adminId,
      },
    });
  }

  console.log(
    'Affectations: 4 chauffeurs (DRIVER) | 6 affectations (3 ACTIVE | 3 TERMINEE)',
  );
}
