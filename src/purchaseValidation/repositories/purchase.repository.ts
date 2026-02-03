import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Purchase, Prisma, PurchaseStatus, PurchaseStep } from '@prisma/client';

@Injectable()
export class PurchaseRepository {
  constructor(private prisma: PrismaService) {}

  //Include standard pour recuperer toutes les relations
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

  //trouver une purchase par ID
  async findById(id: string): Promise<Purchase | null> {
    return this.prisma.purchase.findUnique({
      where: { id },
      include: this.standardInclude,
    });
  }

  //Trouve une purchase par reference
  async findByReference(reference: string): Promise<Purchase | null> {
    return this.prisma.purchase.findUnique({
      where: { reference },
      include: this.standardInclude,
    });
  }

  //trouve plusieurs purchases avec filtres
  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.PurchaseWhereInput;
    orderBy?: Prisma.PurchaseOrderByWithRelationInput;
  }): Promise<Purchase[]> {
    const { skip, take, where, orderBy } = params;

    return this.prisma.purchase.findMany({
      skip,
      take,
      where,
      orderBy,
      include: this.standardInclude,
    });
  }

  //Compte les purchases selon les criteres
  async count(where?: Prisma.PurchaseWhereInput): Promise<number> {
    return this.prisma.purchase.count({ where });
  }

  //creer une nouvelle purchase
  async create(data: Prisma.PurchaseCreateInput): Promise<Purchase> {
    return this.prisma.purchase.create({
      data,
      include: this.standardInclude,
    });
  }

  //Mettre a jour une purchase
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

  //supprimer une purchase
  async delete(where: Prisma.PurchaseWhereUniqueInput): Promise<Purchase> {
    return this.prisma.purchase.delete({
      where,
      include: this.standardInclude,
    });
  }

  //Trouver les purchases par createurs
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

  //Trouver les purchases en attente de validation
  async findPendingvalidation(params: {
    skip?: number;
    take?: number;
    orderBy?: Prisma.PurchaseOrderByWithRelationInput;
  }): Promise<Purchase[] | null> {
    const { skip, take, orderBy } = params;

    return this.findMany({
      skip,
      take,
      where: { status: 'PUBLISHED' },
      orderBy,
    });
  }

  //Trouver les purchases par status
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

  // Mettre a jour le status d'une purchase
  async updateStatus(params: {
    id: string;
    status: PurchaseStatus;
    additionalData: Partial<Prisma.PurchaseUpdateInput>;
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

  //Mettre a jour le currentStep d'un purchase
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

  //Rechercher des purchases par terme
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

  //Compte le purchase par status
  async countByStatus(status: PurchaseStatus): Promise<number> {
    return this.count({ status });
  }

  //Trouve les purchases créees entre deux dates
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
      orderBy: { createdAt: 'asc' },
    });
  }
}
