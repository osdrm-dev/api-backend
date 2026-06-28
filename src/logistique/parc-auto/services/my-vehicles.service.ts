import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { VehicleDocument, VehicleDocumentType } from '@prisma/client';
import {
  ParcAutoRepository,
  VehicleUsedByUser,
} from 'src/repository/parc-auto/parc-auto.repository';
import { UserRepository } from 'src/repository/user/user.repository';
import {
  buildDocumentReminder,
  computeGlobalReminderStatus,
  DocumentReminder,
  REMINDER_THRESHOLD_DAYS,
} from '../utils/document-reminder.util';
import { VehicleWithRemindersDto } from '../dto/return-vehicle-with-reminders.dto';

/** Types de documents toujours présents dans la réponse (FR-12). */
const DOCUMENT_TYPES: VehicleDocumentType[] = [
  VehicleDocumentType.ASSURANCE,
  VehicleDocumentType.VISITE_TECHNIQUE,
  VehicleDocumentType.CARTE_GRISE,
];

/** Au-delà de ce seuil de véhicules dérivés, on logue un warning (NFR-7). */
const VEHICLE_COUNT_WARNING_THRESHOLD = 10;

@Injectable()
export class MyVehiclesService {
  private readonly logger = new Logger(MyVehiclesService.name);

  constructor(
    private readonly parcAutoRepository: ParcAutoRepository,
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Véhicules dérivés de l'utilisateur courant (FR-6).
   */
  async getMyVehicles(userId: number): Promise<VehicleWithRemindersDto[]> {
    return this.buildVehiclesForUser(userId);
  }

  /**
   * Véhicules dérivés d'un utilisateur ciblé (variant ADMIN, FR-9).
   * Lève 404 si l'utilisateur n'existe pas.
   */
  async getVehiclesForUser(userId: number): Promise<VehicleWithRemindersDto[]> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`Utilisateur ${userId} introuvable`);
    }
    return this.buildVehiclesForUser(userId);
  }

  private async buildVehiclesForUser(
    userId: number,
  ): Promise<VehicleWithRemindersDto[]> {
    const vehicles =
      await this.parcAutoRepository.findVehiclesUsedByUser(userId);

    if (vehicles.length > VEHICLE_COUNT_WARNING_THRESHOLD) {
      this.logger.warn(
        `[MES VEHICULES] L'utilisateur ${userId} a ${vehicles.length} véhicules dérivés (> ${VEHICLE_COUNT_WARNING_THRESHOLD}).`,
      );
    }

    const now = new Date();
    return vehicles.map((vehicle) => this.toDto(vehicle, now));
  }

  private toDto(
    vehicle: VehicleUsedByUser,
    now: Date,
  ): VehicleWithRemindersDto {
    const reminders = this.buildReminders(vehicle.documents, now);

    return {
      vehicleId: vehicle.id,
      immatriculation: vehicle.immatriculation,
      marque: vehicle.marque,
      modele: vehicle.modele,
      annee: vehicle.annee,
      statut: vehicle.statut,
      photoFileId: vehicle.photoFileIds[0] ?? null,
      usage: {
        lastUsedAt: vehicle.usage.lastUsedAt,
        usageCount: vehicle.usage.usageCount,
        sources: vehicle.usage.sources,
      },
      globalReminderStatus: computeGlobalReminderStatus(reminders),
      reminders,
    };
  }

  /**
   * Construit la liste des 3 rappels (un par type), en utilisant le document
   * actif s'il existe, sinon une entrée INCONNU (FR-10 / FR-12).
   */
  private buildReminders(
    documents: VehicleDocument[],
    now: Date,
  ): DocumentReminder[] {
    return DOCUMENT_TYPES.map((type) => {
      const document = documents.find((doc) => doc.type === type) ?? null;
      return buildDocumentReminder(
        document,
        type,
        REMINDER_THRESHOLD_DAYS,
        now,
      );
    });
  }
}
