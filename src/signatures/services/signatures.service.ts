import { Injectable, HttpStatus } from '@nestjs/common';
import { AppException, ErrorCode } from 'src/common/errors';
import type { File as MulterFile } from 'multer';
import { FileStorageService } from 'src/storage/services/file-storage.service';
import {
  SignatureSpecimenRepository,
  SpecimenWithFile,
} from '../repository/signature-specimen.repository';
import {
  SignatureSpecimenResponseDto,
  DeleteSignatureResponseDto,
} from '../dto/signature-specimen.dto';

const MAX_SPECIMENS = 5;
const ALLOWED_TYPES = ['image/png', 'image/jpeg'];
const MAX_SIZE = 2 * 1024 * 1024;

@Injectable()
export class SignaturesService {
  constructor(
    private readonly repo: SignatureSpecimenRepository,
    private readonly fileStorage: FileStorageService,
  ) {}

  async findAll(userId: number): Promise<SignatureSpecimenResponseDto[]> {
    const specimens = await this.repo.findAllByUser(userId);
    return specimens.map((s) => this.toDto(s));
  }

  async findActive(userId: number): Promise<SignatureSpecimenResponseDto> {
    const specimen = await this.repo.findActiveByUser(userId);
    if (!specimen) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.SIGNATURE_NO_ACTIVE_SPECIMEN,
        'No active signature specimen',
      );
    }
    return this.toDto(specimen);
  }

  async upload(
    file: MulterFile,
    userId: number,
  ): Promise<SignatureSpecimenResponseDto> {
    const count = await this.repo.countByUser(userId);
    if (count >= MAX_SPECIMENS) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.SIGNATURE_MAX_SPECIMENS_REACHED,
        `Maximum ${MAX_SPECIMENS} specimens allowed`,
        { params: { max: MAX_SPECIMENS } },
      );
    }

    const uploaded = await this.fileStorage.upload(file, {
      userId,
      allowedTypes: ALLOWED_TYPES,
      maxSize: MAX_SIZE,
    });

    const isFirst = count === 0;
    const specimen = await this.repo.create(userId, uploaded.id);

    if (isFirst) {
      return this.toDto(await this.repo.activateOne(specimen.id, userId));
    }

    return this.toDto(specimen);
  }

  async activate(
    id: number,
    userId: number,
  ): Promise<SignatureSpecimenResponseDto> {
    await this.assertOwnership(id, userId);
    const updated = await this.repo.activateOne(id, userId);
    return this.toDto(updated);
  }

  async remove(
    id: number,
    userId: number,
  ): Promise<{ deleted: true } | DeleteSignatureResponseDto> {
    const specimen = await this.assertOwnership(id, userId);

    await this.repo.deleteById(id);
    await this.fileStorage.delete(specimen.fileId);

    if (!specimen.isActive) {
      return { deleted: true };
    }

    const remaining = await this.repo.findAllByUser(userId);
    if (remaining.length === 0) {
      return { deleted: true };
    }

    return {
      requiresNewActive: true,
      remainingSpecimens: remaining.map((s) => this.toDto(s)),
    };
  }

  private async assertOwnership(
    id: number,
    userId: number,
  ): Promise<SpecimenWithFile> {
    const specimen = await this.repo.findByIdAndUser(id, userId);
    if (!specimen) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
        'Specimen not found or access denied',
      );
    }
    return specimen;
  }

  private toDto(specimen: SpecimenWithFile): SignatureSpecimenResponseDto {
    return {
      id: specimen.id,
      userId: specimen.userId,
      fileId: specimen.fileId,
      isActive: specimen.isActive,
      fileUrl: `/files/download/${specimen.fileId}`,
      createdAt: specimen.createdAt.toISOString(),
      updatedAt: specimen.updatedAt.toISOString(),
    };
  }
}
