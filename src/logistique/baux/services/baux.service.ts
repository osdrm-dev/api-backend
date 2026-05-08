import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FileStorageService } from 'src/storage/services/file-storage.service';
import { BauxRepository } from 'src/repository/baux/baux.repository';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';
import { CreateBailDto } from '../dto/create-bail.dto';
import { UpdateBailDto } from '../dto/update-bail.dto';
import { FilterBailDto } from '../dto/filter-bail.dto';
import { LgBailStatut } from '@prisma/client';
import type { File as MulterFile } from 'multer';

const PDF_MIME = 'application/pdf';
const MAX_CONTRAT_SIZE = 10 * 1024 * 1024;

@Injectable()
export class BauxService {
  constructor(
    private readonly repository: BauxRepository,
    private readonly fileStorage: FileStorageService,
    private readonly notificationService: NotificationService,
  ) {}

  async getAll(query: FilterBailDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const { data, total } = await this.repository.findAll(
      {
        statut: query.statut,
        type: query.type,
        site: query.site,
        search: query.search,
        includeArchived: query.includeArchived,
      },
      { skip, take: limit },
    );

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string) {
    const contract = await this.repository.findById(id);
    if (!contract) throw new NotFoundException(`Bail ${id} introuvable.`);
    return contract;
  }

  async create(dto: CreateBailDto) {
    const dateDebut = new Date(dto.dateDebut);
    const dateFin = new Date(dto.dateFin);

    if (dateFin <= dateDebut) {
      throw new BadRequestException(
        'La date de fin doit être postérieure à la date de début.',
      );
    }

    const dureeInitialeMois =
      (dateFin.getFullYear() - dateDebut.getFullYear()) * 12 +
      (dateFin.getMonth() - dateDebut.getMonth());

    const year = new Date().getFullYear();
    const reference = await this.repository.generateNextReference(year);

    console.log(dto);
    return this.repository.create({
      reference,
      type: dto.type,
      bailleur: dto.bailleur,
      preneur: dto.preneur,
      objetBail: dto.objetBail,
      site: dto.site,
      dateSignature: dto.dateSignature
        ? new Date(dto.dateSignature)
        : undefined,
      dateDebut,
      dateFin,
      dureeInitialeMois,
      montantMensuel: dto.montantMensuel.toString(),
      montantDepotGarantie: dto.montantDepotGarantie?.toString(),
      conditionsParticulieres: dto.conditionsParticulieres,
      indexationRate: (dto.indexationRate ?? 0).toString(),
      indexationMois: dto.indexationMois ?? 1,
    });
  }

  async update(id: string, dto: UpdateBailDto) {
    await this.getById(id);

    const updateData: any = { ...dto };

    if (dto.dateDebut) updateData.dateDebut = new Date(dto.dateDebut);
    if (dto.dateFin) updateData.dateFin = new Date(dto.dateFin);
    if (dto.dateSignature)
      updateData.dateSignature = new Date(dto.dateSignature);

    const dateDebut = updateData.dateDebut;
    const dateFin = updateData.dateFin;
    if (dateDebut && dateFin && dateFin <= dateDebut) {
      throw new BadRequestException(
        'La date de fin doit être postérieure à la date de début.',
      );
    }

    if (dateDebut && dateFin) {
      updateData.dureeInitialeMois =
        (dateFin.getFullYear() - dateDebut.getFullYear()) * 12 +
        (dateFin.getMonth() - dateDebut.getMonth());
    }

    return this.repository.update(id, updateData);
  }

  async archive(id: string) {
    await this.getById(id);
    return this.repository.update(id, { statut: LgBailStatut.ARCHIVE });
  }

  async uploadContrat(id: string, file: MulterFile, userId: number) {
    await this.getById(id);

    if (file.mimetype !== PDF_MIME) {
      throw new BadRequestException('Le contrat doit être un fichier PDF.');
    }

    const stored = await this.fileStorage.upload(file, {
      userId,
      allowedTypes: [PDF_MIME],
      maxSize: MAX_CONTRAT_SIZE,
    });

    const updated = await this.repository.update(id, {
      contratFile: { connect: { id: stored.id } },
    });

    await this.notificationService.createNotification(
      OSDRM_PROCESS_EVENT.BAIL_CONTRAT_UPLOADED,
      [],
      id,
      { contractId: id, fileId: stored.id },
    );

    return updated;
  }
}
