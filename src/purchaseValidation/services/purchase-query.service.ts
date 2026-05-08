import { Injectable } from '@nestjs/common';
import { ValidatorRole, PurchaseStatus } from '@prisma/client';
import { PurchaseRepository } from '../../repository/purchase/purchase.repository';

export interface FilterOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: PurchaseStatus;
  currentStep?: string;
  priority?: string;
  project?: string;
  region?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
}

@Injectable()
export class PurchaseQueryService {
  constructor(private purchaseRepo: PurchaseRepository) {}

  buildWhereClause(filters: FilterOptions, additionalCriteria?: any): any {
    const where: any = { ...additionalCriteria };

    if (filters.status) where.status = filters.status;
    if (filters.currentStep) where.currentStep = filters.currentStep;
    if (filters.priority) where.priority = filters.priority;

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

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      where.items = { some: {} };
    }

    return where;
  }

  private buildValidatorWhere(
    userRole: ValidatorRole,
    filters: FilterOptions = {},
  ): any {
    return this.buildWhereClause(
      { ...filters, status: undefined },
      {
        status: {
          in: [
            PurchaseStatus.PUBLISHED,
            PurchaseStatus.PENDING_APPROVAL,
            PurchaseStatus.IN_DEROGATION,
          ],
        },
        validationWorkflows: {
          some: {
            isComplete: false,
            validators: {
              some: {
                role: userRole,
                isValidated: false,
                // NOTE: on ne filtre PAS sur `order` ici intentionnellement.
                // Le filtre JS dans findForValidator vérifie que c'est bien
                // le PROCHAIN validateur non validé (ordre croissant) qui correspond
                // au rôle de l'utilisateur. Filtrer sur order: 0 ici empêchait
                // les validateurs d'ordre > 0 de voir leurs demandes en attente.
              },
            },
          },
        },
      },
    );
  }

  async findForValidator(userRole: ValidatorRole, filters: FilterOptions) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;
    const skip = (page - 1) * limit;

    const where = this.buildValidatorWhere(userRole, filters);

    // On récupère tous les candidats sans pagination d'abord, car le filtre JS
    // (vérification du tour exact du validateur) peut réduire le nombre de résultats.
    // Paginer avant ce filtre rendrait le `total` et les pages incorrects.
    const allCandidates = await this.purchaseRepo.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
    });

    const filtered = allCandidates
      .filter((purchase: any) => {
        const currentWorkflow = purchase.validationWorkflows?.find(
          (w: any) => w.step === purchase.currentStep && !w.isComplete,
        );
        if (!currentWorkflow?.validators?.length) return false;
        const nextValidator = currentWorkflow.validators
          .filter((v: any) => !v.isValidated)
          .sort((a: any, b: any) => a.order - b.order)[0];
        return nextValidator?.role === userRole;
      })
      .map((purchase: any) => ({
        ...purchase,
        amount:
          purchase.items?.reduce(
            (sum: number, item: any) => sum + item.amount,
            0,
          ) || 0,
      }));

    // Pagination manuelle après le filtre JS pour que total et totalPages soient exacts
    const total = filtered.length;
    const data = filtered.slice(skip, skip + limit);

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

  async countForValidator(userRole: ValidatorRole): Promise<number> {
    const where = this.buildValidatorWhere(userRole);
    return this.purchaseRepo.count(where);
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

  async findValidatedForQR(filters: FilterOptions, acheteurId?: number) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;
    const skip = (page - 1) * limit;

    const additionalCriteria: any = {
      status: {
        in: [PurchaseStatus.PUBLISHED, PurchaseStatus.AWAITING_DOCUMENTS],
      },
      currentStep: 'QR',
    };

    if (acheteurId !== undefined) {
      additionalCriteria.acheteurId = acheteurId;
    }

    const where = this.buildWhereClause(filters, additionalCriteria);

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
