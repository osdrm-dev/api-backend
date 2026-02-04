import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Purchase, Prisma, PurchaseStatus, PurchaseStep } from '@prisma/client';

// Type pour Purchase avec toutes les relations
type PurchaseWithRelations = Purchase & {
  creator: any;
  items: any[];
  attachments: any[];
  derogation: any;
  validationWorkflow: any;
};

/**
 * Repository pour gérer l'accès aux données Purchase
 * Suit le pattern Repository pour séparer la logique métier de l'accès aux données
 */
@Injectable()
export class PurchaseRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Include standard pour récupérer toutes les relations
   */
  private readonly standardInclude: Prisma.PurchaseInclude = {
    creator: {
      select: {
        id: true,
        name: true,
        email: true,
        fonction: true,
        role: true,
      },
    },
    items: true,
    attachments: true,
    derogation: true,
    validationWorkflow: {
      include: {
        validators: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                fonction: true,
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    },
  };

  /**
   * Trouve une purchase par ID
   */
  async findById(id: string): Promise<PurchaseWithRelations | null> {
    return this.prisma.purchase.findUnique({
      where: { id },
      include: this.standardInclude,
    }) as Promise<PurchaseWithRelations | null>;
  }

  /**
   * Trouve une purchase par référence
   */
  async findByReference(
    reference: string,
  ): Promise<PurchaseWithRelations | null> {
    return this.prisma.purchase.findUnique({
      where: { reference },
      include: this.standardInclude,
    }) as Promise<PurchaseWithRelations | null>;
  }

  /**
   * Trouve plusieurs purchases avec filtres
   */
  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.PurchaseWhereInput;
    orderBy?: Prisma.PurchaseOrderByWithRelationInput;
  }): Promise<PurchaseWithRelations[]> {
    const { skip, take, where, orderBy } = params;

    return this.prisma.purchase.findMany({
      skip,
      take,
      where,
      orderBy,
      include: this.standardInclude,
    }) as Promise<PurchaseWithRelations[]>;
  }

  /**
   * Compte les purchases selon un critère
   */
  async count(where?: Prisma.PurchaseWhereInput): Promise<number> {
    return this.prisma.purchase.count({ where });
  }

  /**
   * Crée une nouvelle purchase
   */
  async create(data: Prisma.PurchaseCreateInput): Promise<Purchase> {
    return this.prisma.purchase.create({
      data,
      include: this.standardInclude,
    });
  }

  /**
   * Met à jour une purchase
   */
  async update(params: {
    where: Prisma.PurchaseWhereUniqueInput;
    data: Prisma.PurchaseUpdateInput;
  }): Promise<Purchase> {
    const { where, data } = params;

    return this.prisma.purchase.update({
      where,
      data,
      include: this.standardInclude,
    });
  }

  /**
   * Supprime une purchase
   */
  async delete(where: Prisma.PurchaseWhereUniqueInput): Promise<Purchase> {
    return this.prisma.purchase.delete({
      where,
      include: this.standardInclude,
    });
  }

  /**
   * Trouve les purchases par créateur
   */
  async findByCreator(params: {
    creatorId: number;
    skip?: number;
    take?: number;
    status?: PurchaseStatus;
    orderBy?: Prisma.PurchaseOrderByWithRelationInput;
  }): Promise<Purchase[]> {
    const { creatorId, skip, take, status, orderBy } = params;

    const where: Prisma.PurchaseWhereInput = { creatorId };
    if (status) {
      where.status = status;
    }

    return this.findMany({ skip, take, where, orderBy });
  }

  /**
   * Trouve les purchases en attente de validation
   */
  async findPendingValidation(params: {
    skip?: number;
    take?: number;
    orderBy?: Prisma.PurchaseOrderByWithRelationInput;
  }): Promise<Purchase[]> {
    const { skip, take, orderBy } = params;

    return this.findMany({
      skip,
      take,
      where: { status: 'PUBLISHED' },
      orderBy,
    });
  }

  /**
   * Trouve les purchases par statut
   */
  async findByStatus(params: {
    status: PurchaseStatus;
    skip?: number;
    take?: number;
    orderBy?: Prisma.PurchaseOrderByWithRelationInput;
  }): Promise<Purchase[]> {
    const { status, skip, take, orderBy } = params;

    return this.findMany({
      skip,
      take,
      where: { status },
      orderBy,
    });
  }

  /**
   * Met à jour le statut d'une purchase
   */
  async updateStatus(params: {
    id: string;
    status: PurchaseStatus;
    additionalData?: Partial<Prisma.PurchaseUpdateInput>;
  }): Promise<Purchase> {
    const { id, status, additionalData = {} } = params;

    return this.update({
      where: { id },
      data: {
        status,
        ...additionalData,
      },
    });
  }

  /**
   * Met à jour le currentStep d'une purchase
   */
  async updateStep(params: {
    id: string;
    currentStep: PurchaseStep;
  }): Promise<Purchase> {
    const { id, currentStep } = params;

    return this.update({
      where: { id },
      data: { currentStep },
    });
  }

  /**
   * Recherche des purchases par terme
   */
  async search(params: {
    searchTerm: string;
    skip?: number;
    take?: number;
    status?: PurchaseStatus;
  }): Promise<Purchase[]> {
    const { searchTerm, skip, take, status } = params;

    const where: Prisma.PurchaseWhereInput = {
      OR: [
        { reference: { contains: searchTerm, mode: 'insensitive' } },
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ],
    };

    if (status) {
      where.status = status;
    }

    return this.findMany({
      skip,
      take,
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Compte les purchases par statut
   */
  async countByStatus(status: PurchaseStatus): Promise<number> {
    return this.count({ status });
  }

  /**
   * Trouve les purchases créées entre deux dates
   */
  async findByDateRange(params: {
    startDate: Date;
    endDate: Date;
    skip?: number;
    take?: number;
  }): Promise<Purchase[]> {
    const { startDate, endDate, skip, take } = params;

    return this.findMany({
      skip,
      take,
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
