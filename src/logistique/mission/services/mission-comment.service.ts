import { Injectable, NotFoundException } from '@nestjs/common';
import { MissionRepository } from 'src/repository/mission/mission.repository';
import { MissionCommentRepository } from 'src/repository/mission/mission-comment.repository';
import { AddMissionCommentDto } from '../dto/add-mission-comment.dto';

@Injectable()
export class MissionCommentService {
  constructor(
    private readonly missionRepository: MissionRepository,
    private readonly commentRepository: MissionCommentRepository,
  ) {}

  async addComment(
    missionId: string,
    dto: AddMissionCommentDto,
    authorId: number,
  ) {
    const dep = await this.missionRepository.findById(missionId);
    if (!dep) throw new NotFoundException(`Trajet ${missionId} introuvable.`);

    return this.commentRepository.create({
      content: dto.content,
      mission: { connect: { id: missionId } },
      author: { connect: { id: authorId } },
    });
  }

  async getComments(missionId: string) {
    const dep = await this.missionRepository.findById(missionId);
    if (!dep) throw new NotFoundException(`Trajet ${missionId} introuvable.`);

    return this.commentRepository.findByMissionId(missionId);
  }
}
