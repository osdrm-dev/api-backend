import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { FileStorageService } from 'src/storage/services/file-storage.service';
import { ParcAutoRepository } from 'src/repository/parc-auto/parc-auto.repository';
import type { File as MulterFile } from 'multer';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { ListVehiclesQueryDto } from './dto/list-vehicles-query.dto';
import { VehicleDocumentType, VehicleStatut } from '@prisma/client';

const ALLOWED_PHOTO_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

@Injectable()
export class ParcAutoService {
  constructor(
    private readonly repository: ParcAutoRepository,
    private readonly fileStorage: FileStorageService,
  ) {}

  async getAll(query: ListVehiclesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const { data, total } = await this.repository.findAll(
      {
        statut: query.statut,
        marque: query.marque,
        search: query.search,
        includeArchived: query.includeArchived,
      },
      { skip, take: limit },
    );

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getById(id: string) {
    const vehicle = await this.repository.findById(id);
    if (!vehicle) {
      throw new NotFoundException('Véhicule introuvable.');
    }
    return vehicle;
  }

  async create(dto: CreateVehicleDto) {
    const existing = await this.repository.findByImmatriculation(
      dto.immatriculation,
    );
    if (existing) {
      throw new ConflictException(
        'Cette immatriculation est déjà enregistrée.',
      );
    }
    return this.repository.create({
      immatriculation: dto.immatriculation,
      marque: dto.marque,
      modele: dto.modele,
      annee: dto.annee,
    });
  }

  async update(id: string, dto: UpdateVehicleDto) {
    await this.getById(id);
    return this.repository.update(id, dto);
  }

  async archive(id: string) {
    await this.getById(id);
    return this.repository.archive(id);
  }

  async getPhotos(vehicleId: string) {
    await this.getById(vehicleId);
    return this.repository.findPhotoFiles(vehicleId);
  }

  async uploadPhotos(
    vehicleId: string,
    files: MulterFile[],
    uploadedById: number,
  ) {
    const vehicle = await this.getById(vehicleId);
    if (vehicle.statut === VehicleStatut.ARCHIVE) {
      throw new BadRequestException(
        "Impossible d'ajouter des photos à un véhicule archivé.",
      );
    }

    for (const file of files) {
      if (!ALLOWED_PHOTO_TYPES.includes(file.mimetype)) {
        throw new BadRequestException(
          `Type de fichier non autorisé : ${file.mimetype}. Seules les images sont acceptées.`,
        );
      }
    }

    for (const file of files) {
      const savedFile = await this.fileStorage.upload(file, {
        userId: uploadedById,
        allowedTypes: ALLOWED_PHOTO_TYPES,
      });
      await this.repository.appendPhoto(vehicleId, savedFile.id);
    }

    return this.getById(vehicleId);
  }

  async deletePhoto(vehicleId: string, fileId: number) {
    const vehicle = await this.getById(vehicleId);
    if (!vehicle.photoFileIds.includes(fileId)) {
      throw new NotFoundException('Photo introuvable pour ce véhicule.');
    }

    await this.repository.removePhoto(vehicleId, fileId);

    const refCount = await this.repository.countDocumentFileReferences(fileId);
    if (refCount === 0) {
      await this.fileStorage.delete(fileId);
    }
  }

  async getDocuments(vehicleId: string) {
    await this.getById(vehicleId);
    const docs = await this.repository.findDocumentsByVehicle(vehicleId);

    const allTypes = Object.values(VehicleDocumentType);

    return allTypes.map((type) => {
      const typeDocs = docs.filter((d) => d.type === type);
      const active = typeDocs.find((d) => d.isActive) ?? null;
      const history = typeDocs.filter((d) => !d.isActive);
      return { type, active, history };
    });
  }

  async uploadDocument(
    vehicleId: string,
    file: MulterFile,
    dto: UploadDocumentDto,
    uploadedById: number,
  ) {
    const vehicle = await this.getById(vehicleId);
    if (vehicle.statut === VehicleStatut.ARCHIVE) {
      throw new BadRequestException(
        "Impossible d'ajouter un document à un véhicule archivé.",
      );
    }

    if (!ALLOWED_DOCUMENT_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Type de fichier non autorisé : ${file.mimetype}.`,
      );
    }

    const savedFile = await this.fileStorage.upload(file, {
      userId: uploadedById,
      allowedTypes: ALLOWED_DOCUMENT_TYPES,
    });

    return this.repository.createDocumentSupersedingPrevious({
      vehicleId,
      type: dto.type,
      reference: dto.reference,
      dateDebut: dto.dateDebut ? new Date(dto.dateDebut) : undefined,
      dateExpiration: new Date(dto.dateExpiration),
      fileId: savedFile.id,
    });
  }
}
