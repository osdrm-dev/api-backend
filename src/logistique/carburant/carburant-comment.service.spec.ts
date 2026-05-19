import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LgCarburantStatus, LgTypeCarburant } from '@prisma/client';
import { CarburantCommentService } from './carburant-comment.service';
import { CarburantService } from './carburant.service';
import { CarburantCommentRepository } from 'src/repository/carburant/carburant-comment.repository';

const mockCarburantService = {
  findById: jest.fn(),
};

const mockCommentRepository = {
  findByCarburantId: jest.fn(),
  create: jest.fn(),
};

const BASE_CARBURANT = {
  id: 'car-1',
  reference: 'CAR-2026-0001',
  status: LgCarburantStatus.PENDING,
  typeCarburant: LgTypeCarburant.GASOIL,
  volumeLitres: 50,
  montantTotal: 225000,
  requestorId: 10,
  requestor: {
    id: 10,
    email: 'user@example.com',
    name: 'Test User',
    role: 'DEMANDEUR',
  },
  deletedAt: null,
};

const BASE_COMMENT = {
  id: 'comment-1',
  carburantId: 'car-1',
  content: 'Commentaire test',
  authorId: 10,
  author: { id: 10, name: 'Test User', role: 'DEMANDEUR' },
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('CarburantCommentService', () => {
  let service: CarburantCommentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CarburantCommentService,
        { provide: CarburantService, useValue: mockCarburantService },
        {
          provide: CarburantCommentRepository,
          useValue: mockCommentRepository,
        },
      ],
    }).compile();

    service = module.get<CarburantCommentService>(CarburantCommentService);
  });

  describe('addComment', () => {
    it('adds a comment when caller is the owner', async () => {
      mockCarburantService.findById.mockResolvedValue(BASE_CARBURANT);
      mockCommentRepository.create.mockResolvedValue(BASE_COMMENT);

      const result = await service.addComment('car-1', 'Commentaire test', {
        id: 10,
        role: 'DEMANDEUR',
      });
      expect(result).toEqual(BASE_COMMENT);
      expect(mockCommentRepository.create).toHaveBeenCalledWith({
        carburantId: 'car-1',
        authorId: 10,
        content: 'Commentaire test',
      });
    });

    it('throws ForbiddenException when DEMANDEUR is not the owner', async () => {
      mockCarburantService.findById.mockRejectedValue(new ForbiddenException());

      await expect(
        service.addComment('car-1', 'Commentaire test', {
          id: 99,
          role: 'DEMANDEUR',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when carburant does not exist', async () => {
      mockCarburantService.findById.mockRejectedValue(new NotFoundException());

      await expect(
        service.addComment('car-999', 'Commentaire test', {
          id: 10,
          role: 'DEMANDEUR',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows ADMIN to add a comment on any approvisionnement', async () => {
      mockCarburantService.findById.mockResolvedValue(BASE_CARBURANT);
      mockCommentRepository.create.mockResolvedValue({
        ...BASE_COMMENT,
        authorId: 1,
        author: { id: 1, name: 'Admin', role: 'ADMIN' },
      });

      const result = await service.addComment('car-1', 'Commentaire admin', {
        id: 1,
        role: 'ADMIN',
      });
      expect(result).toBeDefined();
      expect(mockCommentRepository.create).toHaveBeenCalledWith({
        carburantId: 'car-1',
        authorId: 1,
        content: 'Commentaire admin',
      });
    });
  });

  describe('getComments', () => {
    it('returns comments for the owner', async () => {
      mockCarburantService.findById.mockResolvedValue(BASE_CARBURANT);
      mockCommentRepository.findByCarburantId.mockResolvedValue([BASE_COMMENT]);

      const result = await service.getComments('car-1', {
        id: 10,
        role: 'DEMANDEUR',
      });
      expect(result).toEqual([BASE_COMMENT]);
      expect(mockCommentRepository.findByCarburantId).toHaveBeenCalledWith(
        'car-1',
      );
    });

    it('throws ForbiddenException when DEMANDEUR is not the owner', async () => {
      mockCarburantService.findById.mockRejectedValue(new ForbiddenException());

      await expect(
        service.getComments('car-1', { id: 99, role: 'DEMANDEUR' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
