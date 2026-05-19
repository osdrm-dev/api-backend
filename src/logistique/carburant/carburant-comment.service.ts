import { Injectable } from '@nestjs/common';
import { CarburantService } from './carburant.service';
import { CarburantCommentRepository } from 'src/repository/carburant/carburant-comment.repository';

@Injectable()
export class CarburantCommentService {
  constructor(
    private readonly carburantService: CarburantService,
    private readonly carburantCommentRepository: CarburantCommentRepository,
  ) {}

  async getComments(carburantId: string, caller: { id: number; role: string }) {
    await this.carburantService.findById(carburantId, caller);
    return this.carburantCommentRepository.findByCarburantId(carburantId);
  }

  async addComment(
    carburantId: string,
    content: string,
    caller: { id: number; role: string },
  ) {
    await this.carburantService.findById(carburantId, caller);
    return this.carburantCommentRepository.create({
      carburantId,
      authorId: caller.id,
      content,
    });
  }
}
