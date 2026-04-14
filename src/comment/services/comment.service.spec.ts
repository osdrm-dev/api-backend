import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CommentService } from './comment.service';
import { CommentRepository } from 'src/repository/purchase/comment.repository';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { PrismaService } from 'prisma/prisma.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';

describe('CommentService', () => {
  let service: CommentService;
  let prisma: PrismaService;
  let commentRepository: CommentRepository;
  let notificationService: NotificationService;

  const mockPrismaService = {
    purchase: {
      findUnique: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    purchaseComment: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockCommentRepository = {
    create: jest.fn(),
    findPaginated: jest.fn(),
  };

  const mockNotificationService = {
    createNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CommentRepository, useValue: mockCommentRepository },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<CommentService>(CommentService);
    prisma = module.get<PrismaService>(PrismaService);
    commentRepository = module.get<CommentRepository>(CommentRepository);
    notificationService = module.get<NotificationService>(NotificationService);

    jest.clearAllMocks();
  });

  describe('findByPurchase', () => {
    it('should return paginated comments', async () => {
      const purchaseId = 'purchase-1';
      const mockComments = [
        {
          id: 'comment-1',
          purchaseId,
          content: 'Test comment',
          currentStep: 'DA',
          createdAt: new Date(),
          updatedAt: new Date(),
          author: { id: 1, name: 'John', role: 'DEMANDEUR' },
        },
      ];

      mockPrismaService.purchase.findUnique.mockResolvedValue({
        id: purchaseId,
      });
      mockCommentRepository.findPaginated.mockResolvedValue({
        data: mockComments,
        total: 1,
      });

      const result = await service.findByPurchase(purchaseId, 1, 10);

      expect(result).toEqual({
        data: mockComments,
        pagination: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      });
      expect(mockCommentRepository.findPaginated).toHaveBeenCalledWith(
        purchaseId,
        1,
        10,
      );
    });

    it('should throw NotFoundException when purchase does not exist', async () => {
      mockPrismaService.purchase.findUnique.mockResolvedValue(null);

      await expect(
        service.findByPurchase('nonexistent', 1, 10),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return empty result when no comments exist', async () => {
      mockPrismaService.purchase.findUnique.mockResolvedValue({
        id: 'purchase-1',
      });
      mockCommentRepository.findPaginated.mockResolvedValue({
        data: [],
        total: 0,
      });

      const result = await service.findByPurchase('purchase-1', 1, 10);

      expect(result).toEqual({
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        },
      });
    });

    it('should compute totalPages correctly', async () => {
      mockPrismaService.purchase.findUnique.mockResolvedValue({
        id: 'purchase-1',
      });
      mockCommentRepository.findPaginated.mockResolvedValue({
        data: Array(10).fill({}),
        total: 25,
      });

      const result = await service.findByPurchase('purchase-1', 1, 10);

      expect(result.pagination.totalPages).toBe(3);
    });
  });

  describe('create', () => {
    const basePurchase = {
      id: 'purchase-1',
      reference: 'DA-2026-001',
      title: 'Test Purchase',
      currentStep: 'DA',
      creator: { id: 2, email: 'creator@test.com', name: 'Creator' },
      validationWorkflows: [
        {
          validators: [
            { email: 'validator1@test.com' },
            { email: 'validator2@test.com' },
          ],
        },
      ],
    };

    const createdComment = {
      id: 'comment-new',
      purchaseId: 'purchase-1',
      authorId: 1,
      content: 'Hello World',
      currentStep: 'DA',
      createdAt: new Date(),
      updatedAt: new Date(),
      author: { id: 1, name: 'Author', role: 'DEMANDEUR' },
    };

    it('should create a comment and send notification (happy path)', async () => {
      mockPrismaService.purchase.findUnique.mockResolvedValue(basePurchase);
      mockCommentRepository.create.mockResolvedValue(createdComment);
      mockPrismaService.user.findMany.mockResolvedValue([
        { email: 'admin@test.com' },
      ]);
      mockPrismaService.user.findUnique.mockResolvedValue({
        email: 'author@test.com',
      });
      mockNotificationService.createNotification.mockResolvedValue({});

      const result = await service.create('purchase-1', 1, {
        content: 'Hello World',
      });

      expect(result).toEqual(createdComment);
      expect(mockCommentRepository.create).toHaveBeenCalledWith({
        purchaseId: 'purchase-1',
        authorId: 1,
        content: 'Hello World',
        currentStep: 'DA',
      });
      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        OSDRM_PROCESS_EVENT.PURCHASE_COMMENT_ADDED,
        expect.any(Array),
        'purchase-1',
        expect.objectContaining({
          reference: 'DA-2026-001',
          purchaseTitle: 'Test Purchase',
          authorName: 'Author',
          currentStep: 'DA',
          commentExcerpt: 'Hello World',
        }),
        false,
        expect.any(Date),
      );
    });

    it('should throw NotFoundException when purchase does not exist', async () => {
      mockPrismaService.purchase.findUnique.mockResolvedValue(null);

      await expect(
        service.create('nonexistent', 1, { content: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should exclude commenter email from recipients', async () => {
      mockPrismaService.purchase.findUnique.mockResolvedValue(basePurchase);
      mockCommentRepository.create.mockResolvedValue(createdComment);
      // Admin user is the same as the author
      mockPrismaService.user.findMany.mockResolvedValue([
        { email: 'author@test.com' },
      ]);
      mockPrismaService.user.findUnique.mockResolvedValue({
        email: 'author@test.com',
      });

      await service.create('purchase-1', 1, { content: 'Test' });

      const recipientsArg =
        mockNotificationService.createNotification.mock.calls[0][1];
      expect(recipientsArg).not.toContain('author@test.com');
    });

    it('should skip notification when recipients list is empty', async () => {
      const purchaseWithNoOtherUsers = {
        ...basePurchase,
        creator: { id: 1, email: 'author@test.com', name: 'Author' },
        validationWorkflows: [],
      };

      mockPrismaService.purchase.findUnique.mockResolvedValue(
        purchaseWithNoOtherUsers,
      );
      mockCommentRepository.create.mockResolvedValue(createdComment);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.findUnique.mockResolvedValue({
        email: 'author@test.com',
      });

      await service.create('purchase-1', 1, { content: 'Test' });

      expect(mockNotificationService.createNotification).not.toHaveBeenCalled();
    });

    it('should deduplicate recipient emails', async () => {
      const purchaseWithDuplicates = {
        ...basePurchase,
        creator: {
          id: 2,
          email: 'validator1@test.com',
          name: 'CreatorValidator',
        },
      };

      mockPrismaService.purchase.findUnique.mockResolvedValue(
        purchaseWithDuplicates,
      );
      mockCommentRepository.create.mockResolvedValue(createdComment);
      mockPrismaService.user.findMany.mockResolvedValue([
        { email: 'validator1@test.com' },
      ]);
      mockPrismaService.user.findUnique.mockResolvedValue({
        email: 'author@test.com',
      });

      await service.create('purchase-1', 1, { content: 'Test' });

      const recipientsArg =
        mockNotificationService.createNotification.mock.calls[0][1];
      const uniqueRecipients = new Set(recipientsArg);
      expect(recipientsArg.length).toBe(uniqueRecipients.size);
    });

    it('should truncate commentExcerpt to 120 chars', async () => {
      const longContent = 'A'.repeat(200);
      mockPrismaService.purchase.findUnique.mockResolvedValue(basePurchase);
      mockCommentRepository.create.mockResolvedValue({
        ...createdComment,
        content: longContent,
      });
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.findUnique.mockResolvedValue({
        email: 'different@test.com',
      });

      await service.create('purchase-1', 1, { content: longContent });

      const dataArg =
        mockNotificationService.createNotification.mock.calls[0][3];
      expect(dataArg.commentExcerpt).toBe('A'.repeat(120) + '...');
      expect(dataArg.commentExcerpt.length).toBe(123);
    });

    it('should still return comment even if notification fails', async () => {
      mockPrismaService.purchase.findUnique.mockResolvedValue(basePurchase);
      mockCommentRepository.create.mockResolvedValue(createdComment);
      mockPrismaService.user.findMany.mockResolvedValue([
        { email: 'admin@test.com' },
      ]);
      mockPrismaService.user.findUnique.mockResolvedValue({
        email: 'author@test.com',
      });
      mockNotificationService.createNotification.mockRejectedValue(
        new Error('Notification failed'),
      );

      const result = await service.create('purchase-1', 1, {
        content: 'Test',
      });

      expect(result).toEqual(createdComment);
    });
  });
});
