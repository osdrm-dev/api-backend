import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class TripCommentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTripId(tripId: string) {
    return this.prisma.lgTripComment.findMany({
      where: { tripId },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, name: true, role: true } },
      },
    });
  }

  async create(data: { tripId: string; authorId: number; content: string }) {
    return this.prisma.lgTripComment.create({
      data: {
        content: data.content,
        trip: { connect: { id: data.tripId } },
        author: { connect: { id: data.authorId } },
      },
      include: {
        author: { select: { id: true, name: true, role: true } },
      },
    });
  }
}
