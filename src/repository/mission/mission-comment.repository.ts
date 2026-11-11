import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class MissionCommentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.LgMissionCommentCreateInput) {
    return this.prisma.lgMissionComment.create({
      data,
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findByMissionId(missionId: string) {
    return this.prisma.lgMissionComment.findMany({
      where: { missionId },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
