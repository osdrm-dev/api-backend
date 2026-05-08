import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class MaintenanceCommentRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly authorSelect = {
    id: true,
    name: true,
    role: true,
  };

  async create(data: {
    requestId: string;
    authorId?: number;
    content: string;
  }) {
    return this.prisma.maintenanceComment.create({
      data: {
        requestId: data.requestId,
        authorId: data.authorId,
        content: data.content,
      },
      include: {
        author: { select: this.authorSelect },
      },
    });
  }

  async findByRequestId(requestId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.maintenanceComment.findMany({
        where: { requestId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          author: { select: this.authorSelect },
        },
      }),
      this.prisma.maintenanceComment.count({ where: { requestId } }),
    ]);

    return { data, total };
  }
}
