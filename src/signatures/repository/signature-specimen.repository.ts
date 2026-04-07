import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { SignatureSpecimen, File } from '@prisma/client';

export type SpecimenWithFile = SignatureSpecimen & { file: File };

const includeFile = { file: true } as const;

@Injectable()
export class SignatureSpecimenRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllByUser(userId: number): Promise<SpecimenWithFile[]> {
    return this.prisma.signatureSpecimen.findMany({
      where: { userId },
      include: includeFile,
      orderBy: { createdAt: 'desc' },
    });
  }

  findActiveByUser(userId: number): Promise<SpecimenWithFile | null> {
    return this.prisma.signatureSpecimen.findFirst({
      where: { userId, isActive: true },
      include: includeFile,
    });
  }

  findByIdAndUser(
    id: number,
    userId: number,
  ): Promise<SpecimenWithFile | null> {
    return this.prisma.signatureSpecimen.findFirst({
      where: { id, userId },
      include: includeFile,
    });
  }

  countByUser(userId: number): Promise<number> {
    return this.prisma.signatureSpecimen.count({ where: { userId } });
  }

  create(userId: number, fileId: number): Promise<SpecimenWithFile> {
    return this.prisma.signatureSpecimen.create({
      data: { userId, fileId },
      include: includeFile,
    });
  }

  async activateOne(id: number, userId: number): Promise<SpecimenWithFile> {
    const [, updated] = await this.prisma.$transaction([
      this.prisma.signatureSpecimen.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      }),
      this.prisma.signatureSpecimen.update({
        where: { id },
        data: { isActive: true },
        include: includeFile,
      }),
    ]);
    return updated as SpecimenWithFile;
  }

  deleteById(id: number): Promise<SignatureSpecimen> {
    return this.prisma.signatureSpecimen.delete({ where: { id } });
  }
}
