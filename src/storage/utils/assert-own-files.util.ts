import { BadRequestException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

/** Dedupes `fileIds` and checks they were all uploaded by `userId` (prevents attaching someone else's file). */
export async function assertOwnFiles(
  prisma: PrismaService,
  fileIds: number[] | undefined,
  userId: number,
): Promise<number[]> {
  const ids = [...new Set(fileIds ?? [])];
  if (!ids.length) return ids;
  const owned = await prisma.file.count({
    where: { id: { in: ids }, uploadedById: userId },
  });
  if (owned !== ids.length) {
    throw new BadRequestException(
      'Un ou plusieurs documents joints sont introuvables.',
    );
  }
  return ids;
}
