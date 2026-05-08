import { Injectable, NotFoundException } from '@nestjs/common';
import { MaintenanceCommentRepository } from 'src/repository/maintenance/comment.repository';
import { MaintenanceRepository } from 'src/repository/maintenance/maintenance.repository';

@Injectable()
export class MaintenanceCommentService {
  constructor(
    private readonly commentRepository: MaintenanceCommentRepository,
    private readonly maintenanceRepository: MaintenanceRepository,
  ) {}

  async addComment(requestId: string, authorId: number, content: string) {
    const request = await this.maintenanceRepository.findById(requestId);

    if (!request || request.deletedAt !== null) {
      throw new NotFoundException('Demande de maintenance introuvable.');
    }

    return this.commentRepository.create({
      requestId,
      authorId,
      content,
    });
  }

  async getComments(requestId: string, page: number, limit: number) {
    const request = await this.maintenanceRepository.findById(requestId);

    if (!request || request.deletedAt !== null) {
      throw new NotFoundException('Demande de maintenance introuvable.');
    }

    const { data, total } = await this.commentRepository.findByRequestId(
      requestId,
      page,
      limit,
    );

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
