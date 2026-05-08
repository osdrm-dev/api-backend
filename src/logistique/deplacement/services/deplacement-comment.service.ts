import { Injectable, NotFoundException } from '@nestjs/common';
import { DeplacementRepository } from 'src/repository/deplacement/deplacement.repository';
import { DeplacementCommentRepository } from 'src/repository/deplacement/deplacement-comment.repository';
import { AddDeplacementCommentDto } from '../dto/add-deplacement-comment.dto';

@Injectable()
export class DeplacementCommentService {
  constructor(
    private readonly deplacementRepository: DeplacementRepository,
    private readonly commentRepository: DeplacementCommentRepository,
  ) {}

  async addComment(
    deplacementId: string,
    dto: AddDeplacementCommentDto,
    authorId: number,
  ) {
    const dep = await this.deplacementRepository.findById(deplacementId);
    if (!dep)
      throw new NotFoundException(`Déplacement ${deplacementId} introuvable.`);

    return this.commentRepository.create({
      content: dto.content,
      deplacement: { connect: { id: deplacementId } },
      author: { connect: { id: authorId } },
    });
  }

  async getComments(deplacementId: string) {
    const dep = await this.deplacementRepository.findById(deplacementId);
    if (!dep)
      throw new NotFoundException(`Déplacement ${deplacementId} introuvable.`);

    return this.commentRepository.findByDeplacementId(deplacementId);
  }
}
