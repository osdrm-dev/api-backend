import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LgTripStatus, LgTransportMode } from '@prisma/client';
import { TripCommentService } from '../trip-comment.service';
import { TripService } from '../trip.service';
import { TripCommentRepository } from 'src/repository/trip/trip-comment.repository';

const BASE_TRIP = {
  id: 'trip-1',
  reference: 'TRJ-2026-0001',
  status: LgTripStatus.PENDING,
  transportMode: LgTransportMode.TAXI,
  requestorId: 10,
  requestor: {
    id: 10,
    email: 'user@test.com',
    name: 'Test',
    role: 'DEMANDEUR',
  },
  deletedAt: null,
};

const SAMPLE_COMMENTS = [
  {
    id: 'cmt-1',
    tripId: 'trip-1',
    content: 'Premier commentaire',
    authorId: 10,
    author: { id: 10, name: 'Test', role: 'DEMANDEUR' },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockTripService = {
  findById: jest.fn(),
};

const mockCommentRepository = {
  findByTripId: jest.fn(),
  create: jest.fn(),
};

describe('TripCommentService', () => {
  let service: TripCommentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripCommentService,
        { provide: TripService, useValue: mockTripService },
        { provide: TripCommentRepository, useValue: mockCommentRepository },
      ],
    }).compile();

    service = module.get<TripCommentService>(TripCommentService);
  });

  describe('addComment', () => {
    it('allows the owner to add a comment', async () => {
      const caller = { id: 10, role: 'DEMANDEUR' };
      mockTripService.findById.mockResolvedValue(BASE_TRIP);
      mockCommentRepository.create.mockResolvedValue(SAMPLE_COMMENTS[0]);

      const result = await service.addComment(
        'trip-1',
        'Premier commentaire',
        caller,
      );
      expect(result).toEqual(SAMPLE_COMMENTS[0]);
      expect(mockCommentRepository.create).toHaveBeenCalledWith({
        tripId: 'trip-1',
        authorId: 10,
        content: 'Premier commentaire',
      });
    });

    it('throws ForbiddenException when non-owner DEMANDEUR tries to add a comment', async () => {
      const caller = { id: 99, role: 'DEMANDEUR' };
      mockTripService.findById.mockRejectedValue(
        new ForbiddenException('Accès refusé à ce dossier de trajet.'),
      );

      await expect(
        service.addComment('trip-1', 'Commentaire', caller),
      ).rejects.toThrow(ForbiddenException);
      expect(mockCommentRepository.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when trip does not exist', async () => {
      const caller = { id: 10, role: 'DEMANDEUR' };
      mockTripService.findById.mockRejectedValue(
        new NotFoundException('Trajet trip-999 introuvable.'),
      );

      await expect(
        service.addComment('trip-999', 'Commentaire', caller),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getComments', () => {
    it('allows the owner to get comments', async () => {
      const caller = { id: 10, role: 'DEMANDEUR' };
      mockTripService.findById.mockResolvedValue(BASE_TRIP);
      mockCommentRepository.findByTripId.mockResolvedValue(SAMPLE_COMMENTS);

      const result = await service.getComments('trip-1', caller);
      expect(result).toEqual(SAMPLE_COMMENTS);
      expect(mockCommentRepository.findByTripId).toHaveBeenCalledWith('trip-1');
    });

    it('throws ForbiddenException when non-owner DEMANDEUR tries to get comments', async () => {
      const caller = { id: 99, role: 'DEMANDEUR' };
      mockTripService.findById.mockRejectedValue(
        new ForbiddenException('Accès refusé à ce dossier de trajet.'),
      );

      await expect(service.getComments('trip-1', caller)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockCommentRepository.findByTripId).not.toHaveBeenCalled();
    });

    it('allows ADMIN to get comments of any trip', async () => {
      const caller = { id: 1, role: 'ADMIN' };
      mockTripService.findById.mockResolvedValue(BASE_TRIP);
      mockCommentRepository.findByTripId.mockResolvedValue(SAMPLE_COMMENTS);

      const result = await service.getComments('trip-1', caller);
      expect(result).toEqual(SAMPLE_COMMENTS);
    });
  });
});
