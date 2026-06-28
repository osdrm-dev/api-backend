import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { VehicleDocumentType, VehicleStatut } from '@prisma/client';
import { MyVehiclesService } from './my-vehicles.service';
import { ParcAutoRepository } from 'src/repository/parc-auto/parc-auto.repository';
import { UserRepository } from 'src/repository/user/user.repository';

const mockParcAutoRepository = {
  findVehiclesUsedByUser: jest.fn(),
};

const mockUserRepository = {
  findById: jest.fn(),
};

function makeVehicle(overrides: any = {}) {
  return {
    id: 'veh-1',
    immatriculation: '1234 TBA',
    marque: 'Toyota',
    modele: 'Hilux',
    annee: 2022,
    statut: VehicleStatut.ACTIF,
    photoFileIds: [123, 456],
    createdAt: new Date(),
    updatedAt: new Date(),
    documents: [],
    usage: {
      vehicleId: 'veh-1',
      lastUsedAt: new Date('2026-05-28T00:00:00.000Z'),
      usageCount: 3,
      sources: ['TRIP', 'CARBURANT'],
    },
    ...overrides,
  };
}

function makeDoc(type: VehicleDocumentType, dateExpiration: Date | null) {
  return {
    id: `doc-${type}`,
    vehicleId: 'veh-1',
    type,
    reference: `REF-${type}`,
    dateDebut: null,
    dateExpiration,
    isActive: true,
    fileId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('MyVehiclesService', () => {
  let service: MyVehiclesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MyVehiclesService,
        { provide: ParcAutoRepository, useValue: mockParcAutoRepository },
        { provide: UserRepository, useValue: mockUserRepository },
      ],
    }).compile();

    service = module.get<MyVehiclesService>(MyVehiclesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMyVehicles', () => {
    it('AC-1: retourne [] quand aucun véhicule dérivé', async () => {
      mockParcAutoRepository.findVehiclesUsedByUser.mockResolvedValue([]);

      const result = await service.getMyVehicles(1);

      expect(result).toEqual([]);
      expect(
        mockParcAutoRepository.findVehiclesUsedByUser,
      ).toHaveBeenCalledWith(1);
    });

    it('AC-2: expose les métadonnées d’usage agrégées et la photo principale', async () => {
      mockParcAutoRepository.findVehiclesUsedByUser.mockResolvedValue([
        makeVehicle(),
      ]);

      const [vehicle] = await service.getMyVehicles(1);

      expect(vehicle.vehicleId).toBe('veh-1');
      expect(vehicle.photoFileId).toBe(123);
      expect(vehicle.usage).toEqual({
        lastUsedAt: new Date('2026-05-28T00:00:00.000Z'),
        usageCount: 3,
        sources: ['TRIP', 'CARBURANT'],
      });
    });

    it('photoFileId null quand aucune photo', async () => {
      mockParcAutoRepository.findVehiclesUsedByUser.mockResolvedValue([
        makeVehicle({ photoFileIds: [] }),
      ]);

      const [vehicle] = await service.getMyVehicles(1);
      expect(vehicle.photoFileId).toBeNull();
    });

    it('AC-3: tous documents valides (>20j) => globalReminderStatus OK', async () => {
      const farFuture = new Date();
      farFuture.setDate(farFuture.getDate() + 200);
      mockParcAutoRepository.findVehiclesUsedByUser.mockResolvedValue([
        makeVehicle({
          documents: [
            makeDoc(VehicleDocumentType.ASSURANCE, farFuture),
            makeDoc(VehicleDocumentType.VISITE_TECHNIQUE, farFuture),
            makeDoc(VehicleDocumentType.CARTE_GRISE, farFuture),
          ],
        }),
      ]);

      const [vehicle] = await service.getMyVehicles(1);

      expect(vehicle.globalReminderStatus).toBe('OK');
      expect(vehicle.reminders.every((r) => r.reminderStatus === 'OK')).toBe(
        true,
      );
    });

    it('AC-4: un document expiré fait passer globalReminderStatus à EXPIRE', async () => {
      const farFuture = new Date();
      farFuture.setDate(farFuture.getDate() + 200);
      const past = new Date();
      past.setDate(past.getDate() - 5);

      mockParcAutoRepository.findVehiclesUsedByUser.mockResolvedValue([
        makeVehicle({
          documents: [
            makeDoc(VehicleDocumentType.ASSURANCE, past),
            makeDoc(VehicleDocumentType.VISITE_TECHNIQUE, farFuture),
            makeDoc(VehicleDocumentType.CARTE_GRISE, farFuture),
          ],
        }),
      ]);

      const [vehicle] = await service.getMyVehicles(1);
      expect(vehicle.globalReminderStatus).toBe('EXPIRE');
    });

    it('AC-5: les 3 types sont toujours présents, type manquant => INCONNU', async () => {
      const farFuture = new Date();
      farFuture.setDate(farFuture.getDate() + 200);

      mockParcAutoRepository.findVehiclesUsedByUser.mockResolvedValue([
        makeVehicle({
          documents: [makeDoc(VehicleDocumentType.ASSURANCE, farFuture)],
        }),
      ]);

      const [vehicle] = await service.getMyVehicles(1);

      expect(vehicle.reminders).toHaveLength(3);
      const types = vehicle.reminders.map((r) => r.documentType);
      expect(types).toEqual([
        VehicleDocumentType.ASSURANCE,
        VehicleDocumentType.VISITE_TECHNIQUE,
        VehicleDocumentType.CARTE_GRISE,
      ]);
      const carteGrise = vehicle.reminders.find(
        (r) => r.documentType === VehicleDocumentType.CARTE_GRISE,
      )!;
      expect(carteGrise.reminderStatus).toBe('INCONNU');
      expect(carteGrise.dateExpiration).toBeNull();
      expect(carteGrise.daysUntilExpiration).toBeNull();
    });
  });

  describe('getVehiclesForUser (ADMIN)', () => {
    it('AC-9: 404 si utilisateur introuvable', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(service.getVehiclesForUser(999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(
        mockParcAutoRepository.findVehiclesUsedByUser,
      ).not.toHaveBeenCalled();
    });

    it('retourne les véhicules pour un utilisateur existant', async () => {
      mockUserRepository.findById.mockResolvedValue({ id: 7 });
      mockParcAutoRepository.findVehiclesUsedByUser.mockResolvedValue([
        makeVehicle(),
      ]);

      const result = await service.getVehiclesForUser(7);

      expect(result).toHaveLength(1);
      expect(
        mockParcAutoRepository.findVehiclesUsedByUser,
      ).toHaveBeenCalledWith(7);
    });
  });
});
