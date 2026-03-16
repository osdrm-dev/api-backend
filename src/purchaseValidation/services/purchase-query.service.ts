import { Injectable } from '@nestjs/common';
import { ValidatorRole, PurchaseStatus } from '@prisma/client';
import { PurchaseRepository } from '../../repository/purchase/purchase.repository';

export interface FilterOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: PurchaseStatus;
  project?: string;
  region?: string;
  search?: string;
}

@Injectable()
export class PurchaseQueryService {
  constructor(private purchaseRepo: PurchaseRepository) {}

  private buildWhereClause(
    filters: FilterOptions,
    additionalCriteria?: any,
  ): any {
    const where: any = { ...additionalCriteria };

    if (filters.status) where.status = filters.status;
    if (filters.project)
      where.project = { contains: filters.project, mode: 'insensitive' };
    if (filters.region)
      where.region = { contains: filters.region, mode: 'insensitive' };

    if (filters.search) {
      where.OR = [
        { reference: { contains: filters.search, mode: 'insensitive' } },
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  async findForValidator(userRole: ValidatorRole, filters: FilterOptions) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    // On ne transmet pas `status` pour ne pas filtrer : la clause WHERE gère déjà les statuts
    const filtersWithoutStatus: FilterOptions = { ...filters };
    delete filtersWithoutStatus.status;

    const where = this.buildWhereClause(filtersWithoutStatus, {
      status: {
        in: [
          PurchaseStatus.PUBLISHED,
          PurchaseStatus.PENDING_APPROVAL,
          PurchaseStatus.IN_DEROGATION,
        ],
      },
      validationWorkflows: {
        some: {
          validators: {
            some: {
              role: userRole,
              isValidated: false,
            },
          },
        },
      },
    });

    const allCandidates = await this.purchaseRepo.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
    });

    const isMyTurn = (purchase: any): boolean => {
      const currentWorkflow = purchase.validationWorkflows?.find(
        (w: any) => w.step === purchase.currentStep,
      );

      if (!currentWorkflow?.validators?.length) return false;

      const nextValidator = currentWorkflow.validators
        .filter((v: any) => !v.isValidated)
        .sort((a: any, b: any) => a.order - b.order)[0];

      return nextValidator?.role === userRole;
    };

    const validPurchases = allCandidates.filter(isMyTurn);
    const total = validPurchases.length;

    const skip = (page - 1) * limit;
    const paginated = validPurchases.slice(skip, skip + limit);

    const data = paginated.map((purchase: any) => {
      const amount =
        purchase.items?.reduce(
          (sum: number, item: any) => sum + item.amount,
          0,
        ) || 0;

      return { ...purchase, amount };
    });

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByCreator(userId: number, filters: FilterOptions) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;
    const skip = (page - 1) * limit;

    const where = this.buildWhereClause(filters, { creatorId: userId });

    const [purchases, total] = await Promise.all([
      this.purchaseRepo.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.purchaseRepo.count(where),
    ]);

    return {
      data: purchases,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    return this.purchaseRepo.findById(id);
  }

  async findValidatedForQR(filters: FilterOptions) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;
    const skip = (page - 1) * limit;

    const where = this.buildWhereClause(filters, {
      status: { in: ['PUBLISHED', 'AWAITING_DOCUMENTS'] },
      currentStep: 'QR',
    });

    const [purchases, total] = await Promise.all([
      this.purchaseRepo.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.purchaseRepo.count(where),
    ]);

    return {
      data: purchases,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findMany(filters: FilterOptions, additionalWhere?: any) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;
    const skip = (page - 1) * limit;

    const where = this.buildWhereClause(filters, additionalWhere);

    const [purchases, total] = await Promise.all([
      this.purchaseRepo.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.purchaseRepo.count(where),
    ]);

    return {
      data: purchases,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
