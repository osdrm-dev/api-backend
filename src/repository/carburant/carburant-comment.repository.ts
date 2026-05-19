import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class CarburantCommentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByCarburantId(carburantId: string) {
    return this.prisma.lgCarburantComment.findMany({
      where: { carburantId },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, name: true, role: true } },
      },
    });
  }

  async create(data: {
    carburantId: string;
    authorId: number;
    content: string;
  }) {
    return this.prisma.lgCarburantComment.create({
      data: {
        content: data.content,
        carburant: { connect: { id: data.carburantId } },
        author: { connect: { id: data.authorId } },
      },
      include: {
        author: { select: { id: true, name: true, role: true } },
      },
    });
  }
}
