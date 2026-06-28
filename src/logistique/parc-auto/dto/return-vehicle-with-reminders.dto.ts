import { ApiProperty } from '@nestjs/swagger';
import { VehicleDocumentType, VehicleStatut } from '@prisma/client';
import type {
  ReminderStatus,
  DocumentReminder,
} from '../utils/document-reminder.util';
import type { VehicleUsageSource } from 'src/repository/parc-auto/parc-auto.repository';

export class VehicleUsageDto {
  @ApiProperty({
    description:
      "Date d'usage la plus récente par l'utilisateur (max sur les 3 sources)",
    type: String,
    format: 'date-time',
  })
  lastUsedAt: Date;

  @ApiProperty({
    description:
      "Nombre total d'enregistrements retenus liant l'utilisateur à ce véhicule",
    example: 7,
  })
  usageCount: number;

  @ApiProperty({
    description: "Origines ayant contribué à l'usage du véhicule",
    enum: ['TRIP', 'DEPLACEMENT', 'CARBURANT'],
    isArray: true,
    example: ['TRIP', 'CARBURANT'],
  })
  sources: VehicleUsageSource[];
}

export class DocumentReminderDto implements DocumentReminder {
  @ApiProperty({ enum: VehicleDocumentType })
  documentType: VehicleDocumentType;

  @ApiProperty({ type: String, nullable: true, example: 'POL-2026-00231' })
  reference: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
  })
  dateExpiration: Date | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Jours restants avant expiration (négatif si expiré, null si inconnu)',
    example: 12,
  })
  daysUntilExpiration: number | null;

  @ApiProperty({
    enum: ['OK', 'BIENTOT', 'EXPIRE', 'INCONNU'],
    example: 'BIENTOT',
  })
  reminderStatus: ReminderStatus;
}

export class VehicleWithRemindersDto {
  @ApiProperty({ description: 'Identifiant du véhicule', example: 'clxxx...' })
  vehicleId: string;

  @ApiProperty({ example: '1234 TBA' })
  immatriculation: string;

  @ApiProperty({ example: 'Toyota' })
  marque: string;

  @ApiProperty({ example: 'Hilux' })
  modele: string;

  @ApiProperty({ example: 2022 })
  annee: number;

  @ApiProperty({ enum: VehicleStatut, example: VehicleStatut.ACTIF })
  statut: VehicleStatut;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'ID du fichier de la photo principale (photoFileIds[0])',
    example: 123,
  })
  photoFileId: number | null;

  @ApiProperty({ type: VehicleUsageDto })
  usage: VehicleUsageDto;

  @ApiProperty({
    enum: ['OK', 'BIENTOT', 'EXPIRE', 'INCONNU'],
    description: 'Pire statut parmi les rappels du véhicule',
    example: 'BIENTOT',
  })
  globalReminderStatus: ReminderStatus;

  @ApiProperty({ type: [DocumentReminderDto] })
  reminders: DocumentReminderDto[];
}
