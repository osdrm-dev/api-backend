import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommentEntityType } from '@prisma/client';
import { UnifiedCommentService } from './unified-comment.service';
import { UnifiedCommentRepository } from 'src/repository/comment/unified-comment.repository';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';

describe('UnifiedCommentService', () => {
  let service: UnifiedCommentService;

  const mockRepository = {
    create: jest.fn(),
    findPaginated: jest.fn(),
    softDelete: jest.fn(),
    countByEntityIds: jest.fn(),
  };

  const mockPrismaService = {
    purchase: { findFirst: jest.fn(), findUnique: jest.fn() },
    maintenanceRequest: { findFirst: jest.fn() },
    lgDeplacement: { findFirst: jest.fn() },
    lgTrip: { findFirst: jest.fn() },
    lgCarburant: { findFirst: jest.fn() },
    user: { findMany: jest.fn(), findUnique: jest.fn() },
  };

  const mockNotificationService = {
    createNotification: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnifiedCommentService,
        { provide: UnifiedCommentRepository, useValue: mockRepository },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get(UnifiedCommentService);
  });

  describe('create', () => {
    it('crée un commentaire pour un trajet (happy path, sans notification)', async () => {
      mockPrismaService.lgTrip.findFirst.mockResolvedValue({ id: 'trip-1' });
      const created = {
        id: 'c1',
        entityType: CommentEntityType.TRIP,
        entityId: 'trip-1',
        content: 'Trajet validé.',
        author: { id: 1, name: 'Jean', role: 'ADMIN' },
        authorId: 1,
      };
      mockRepository.create.mockResolvedValue(created);

      const result = await service.create(CommentEntityType.TRIP, 'trip-1', 1, {
        content: 'Trajet validé.',
      });

      expect(mockPrismaService.lgTrip.findFirst).toHaveBeenCalledWith({
        where: { id: 'trip-1', deletedAt: null },
        select: { id: true },
      });
      expect(mockRepository.create).toHaveBeenCalledWith({
        entityType: CommentEntityType.TRIP,
        entityId: 'trip-1',
        authorId: 1,
        content: 'Trajet validé.',
        currentStep: null,
      });
      expect(mockNotificationService.createNotification).not.toHaveBeenCalled();
      expect(result).toBe(created);
    });

    it("lève une 404 quand l'entité est introuvable", async () => {
      mockPrismaService.lgCarburant.findFirst.mockResolvedValue(null);

      await expect(
        service.create(CommentEntityType.CARBURANT, 'missing', 1, {
          content: 'x',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('fire la notification PURCHASE_COMMENT_ADDED pour un achat', async () => {
      mockPrismaService.purchase.findFirst.mockResolvedValue({ id: 'p1' });
      mockPrismaService.purchase.findUnique
        .mockResolvedValueOnce({ currentStep: 'DA' }) // currentStep lookup
        .mockResolvedValueOnce({
          id: 'p1',
          reference: 'DA-001',
          title: 'Achat test',
          currentStep: 'DA',
          creator: { id: 9, email: 'creator@osdrm.mg', name: 'Createur' },
          validationWorkflows: [{ validators: [{ email: 'valid@osdrm.mg' }] }],
        });
      mockPrismaService.user.findMany.mockResolvedValue([
        { email: 'admin@osdrm.mg' },
      ]);
      mockPrismaService.user.findUnique.mockResolvedValue({
        email: 'author@osdrm.mg',
      });
      mockRepository.create.mockResolvedValue({
        id: 'c1',
        content: 'Vérifiez les quantités.',
        author: { id: 1, name: 'Auteur', role: 'OM' },
        authorId: 1,
      });

      await service.create(CommentEntityType.PURCHASE, 'p1', 1, {
        content: 'Vérifiez les quantités.',
      });

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: CommentEntityType.PURCHASE,
          currentStep: 'DA',
        }),
      );
      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        OSDRM_PROCESS_EVENT.PURCHASE_COMMENT_ADDED,
        expect.arrayContaining([
          'creator@osdrm.mg',
          'valid@osdrm.mg',
          'admin@osdrm.mg',
        ]),
        'p1',
        expect.objectContaining({ reference: 'DA-001' }),
        false,
        expect.any(Date),
      );
    });
  });

  describe('findPaginated', () => {
    it('retourne data + pagination avec totalPages calculé', async () => {
      mockRepository.findPaginated.mockResolvedValue({
        data: [{ id: 'c1' }],
        total: 25,
      });

      const result = await service.findPaginated(
        CommentEntityType.TRIP,
        'trip-1',
        2,
        10,
      );

      expect(mockRepository.findPaginated).toHaveBeenCalledWith(
        CommentEntityType.TRIP,
        'trip-1',
        2,
        10,
      );
      expect(result.pagination).toEqual({
        total: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
      });
    });
  });

  describe('delete', () => {
    it("délègue au repository pour l'auteur", async () => {
      mockRepository.softDelete.mockResolvedValue(undefined);
      await service.delete('c1', 1, false);
      expect(mockRepository.softDelete).toHaveBeenCalledWith('c1', 1, false);
    });

    it('délègue au repository pour un ADMIN', async () => {
      mockRepository.softDelete.mockResolvedValue(undefined);
      await service.delete('c1', 99, true);
      expect(mockRepository.softDelete).toHaveBeenCalledWith('c1', 99, true);
    });

    it('propage la ForbiddenException du repository', async () => {
      mockRepository.softDelete.mockRejectedValue(new ForbiddenException());
      await expect(service.delete('c1', 2, false)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
