import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from 'src/common/errors';
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
    const mission = await this.missionRepository.findById(missionId);
    if (!mission)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        `Mission ${missionId} not found`,
      );

    return this.commentRepository.create({
      content: dto.content,
      mission: { connect: { id: missionId } },
      author: { connect: { id: authorId } },
    });
  }

  async getComments(missionId: string) {
    const mission = await this.missionRepository.findById(missionId);
    if (!mission)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        `Mission ${missionId} not found`,
      );

    return this.commentRepository.findByMissionId(missionId);
  }
}
