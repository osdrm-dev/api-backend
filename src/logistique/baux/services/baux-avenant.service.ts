import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from 'src/common/errors';
import { PrismaService } from 'prisma/prisma.service';
import { BauxRepository } from 'src/repository/baux/baux.repository';
import { FileStorageService } from 'src/storage/services/file-storage.service';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';
import { CreateAvenantDto } from '../dto/create-avenant.dto';
import type { File as MulterFile } from 'multer';

const PDF_MIME = 'application/pdf';
const MAX_FILE_SIZE = 10 * 1024 * 1024;

@Injectable()
export class BauxAvenantService {
  constructor(
    private readonly repository: BauxRepository,
    private readonly prisma: PrismaService,
    private readonly fileStorage: FileStorageService,
    private readonly notificationService: NotificationService,
  ) {}

  async listAvenants(contractId: string) {
    const contract = await this.repository.findById(contractId);
    if (!contract)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        `Lease ${contractId} not found`,
      );
    return this.repository.findAvenantsByContract(contractId);
  }

  async addAvenant(
    contractId: string,
    dto: CreateAvenantDto,
    file: MulterFile,
    userId: number,
  ) {
    const contract = await this.repository.findById(contractId);
    if (!contract)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        `Lease ${contractId} not found`,
      );

    if (dto.nouveauMontant !== undefined && dto.nouveauMontant <= 0) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.LEASE_AMENDMENT_AMOUNT_NOT_POSITIVE,
        'New amount must be positive',
        {
          fields: [
            {
              field: 'nouveauMontant',
              code: ErrorCode.LEASE_AMENDMENT_AMOUNT_NOT_POSITIVE,
            },
          ],
        },
      );
    }

    let fileId: number | undefined;
    if (file) {
      if (file.mimetype !== PDF_MIME) {
        throw new AppException(
          HttpStatus.BAD_REQUEST,
          ErrorCode.LEASE_AMENDMENT_FILE_NOT_PDF,
          'Amendment file must be a PDF',
        );
      }
      const stored = await this.fileStorage.upload(file, {
        userId,
        allowedTypes: [PDF_MIME],
        maxSize: MAX_FILE_SIZE,
      });
      fileId = stored.id;
    }

    const avenant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.lgBailAvenant.create({
        data: {
          contractId,
          numero: dto.numero,
          dateSignature: dto.dateSignature
            ? new Date(dto.dateSignature)
            : undefined,
          description: dto.description,
          nouveauMontant: dto.nouveauMontant?.toString(),
          fileId: fileId ?? undefined,
        },
      });

      if (dto.nouveauMontant) {
        await tx.lgBailContract.update({
          where: { id: contractId },
          data: { montantMensuel: dto.nouveauMontant.toString() },
        });
      }

      return created;
    });

    await this.notificationService.createNotification(
      OSDRM_PROCESS_EVENT.BAIL_AVENANT_ADDED,
      [],
      contractId,
      { contractId, avenantId: avenant.id, numero: avenant.numero },
    );

    return avenant;
  }
}
