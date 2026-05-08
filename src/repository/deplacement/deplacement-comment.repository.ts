import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class DeplacementCommentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.LgDeplacementCommentCreateInput) {
    return this.prisma.lgDeplacementComment.create({
      data,
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findByDeplacementId(deplacementId: string) {
    return this.prisma.lgDeplacementComment.findMany({
      where: { deplacementId },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
