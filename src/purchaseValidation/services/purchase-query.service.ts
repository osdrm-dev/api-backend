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

/**
 * Service pour filtrer et récupérer des demandes d'achat
 * Utilise le PurchaseRepository pour l'accès aux données
 */
@Injectable()
export class PurchaseQueryService {
  constructor(private purchaseRepo: PurchaseRepository) {}

  /**
   * Construit une clause WHERE réutilisable
   */
  private buildWhereClause(
    filters: FilterOptions,
    additionalCriteria?: any,
  ): any {
    const where: any = { ...additionalCriteria };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.project) {
      where.project = { contains: filters.project, mode: 'insensitive' };
    }

    if (filters.region) {
      where.region = { contains: filters.region, mode: 'insensitive' };
    }

    if (filters.search) {
      where.OR = [
        { reference: { contains: filters.search, mode: 'insensitive' } },
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  /**
   * Récupère les demandes pour un validateur spécifique
   * Filtre selon l'ordre du workflow (c'est son tour)
   */
  async findForValidator(userRole: ValidatorRole, filters: FilterOptions) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;
    const skip = (page - 1) * limit;

    const filtersForQuery: FilterOptions = { ...filters };
    delete filtersForQuery.status;

    const where = this.buildWhereClause(filtersForQuery, {
      status: { in: ['PUBLISHED', 'PENDING_APPROVAL', 'IN_DEROGATION'] },
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

    // Récupérer en parallèle : page courante + count total
    const [purchases, allPurchases] = await Promise.all([
      this.purchaseRepo.findMany({
        where,
        skip,
        take: limit * 3, // Prendre plus pour compenser le filtrage
        orderBy: { [sortBy]: sortOrder },
      }),
      this.purchaseRepo.findMany({ where }),
    ]);

    // Filtrer pour ne garder que celles où c'est le tour du validateur
    const filterByTurn = (purchase: any) => {
      const currentWorkflow = purchase.validationWorkflows?.find(
        (w) => w.step === purchase.currentStep,
      );
      if (!currentWorkflow?.validators?.length) return false;

      const nextValidator = currentWorkflow.validators
        .filter((v) => !v.isValidated)
        .sort((a, b) => a.order - b.order)[0];

      return nextValidator?.role === userRole;
    };

    const validPurchases = purchases.filter(filterByTurn).slice(0, limit);
    const total = allPurchases.filter(filterByTurn).length;

    const sanitizedPurchases = validPurchases.map((purchase) => {
      const { validationWorkflows, ...rest } = purchase;
      const amount =
        purchase.items?.reduce((sum, item) => sum + item.amount, 0) || 0;
      return { ...rest, amount };
    });

    return {
      data: sanitizedPurchases,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Récupère les demandes créées par un utilisateur
   */
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
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Récupère une demande par ID avec toutes ses relations
   */
  async findById(id: string) {
    return this.purchaseRepo.findById(id);
  }

  /**
   * Récupère les DA validées en étape QR pour les acheteurs
   */
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
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Récupère des demandes selon des critères personnalisés
   */
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
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
