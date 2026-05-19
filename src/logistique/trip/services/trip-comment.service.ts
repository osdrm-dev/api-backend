import { Injectable } from '@nestjs/common';
import { TripService } from './trip.service';
import { TripCommentRepository } from 'src/repository/trip/trip-comment.repository';

@Injectable()
export class TripCommentService {
  constructor(
    private readonly tripService: TripService,
    private readonly tripCommentRepository: TripCommentRepository,
  ) {}

  async getComments(tripId: string, caller: { id: number; role: string }) {
    await this.tripService.findById(tripId, caller);
    return this.tripCommentRepository.findByTripId(tripId);
  }

  async addComment(
    tripId: string,
    content: string,
    caller: { id: number; role: string },
  ) {
    await this.tripService.findById(tripId, caller);
    return this.tripCommentRepository.create({
      tripId,
      authorId: caller.id,
      content,
    });
  }
}
