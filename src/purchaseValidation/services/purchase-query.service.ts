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

    // Récupérer toutes les DA publiées où le validateur est présent
    const where = this.buildWhereClause(filters, {
      status: 'PUBLISHED',
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

    const allPurchases = await this.purchaseRepo.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
    });

    // Filtrer pour ne garder que celles où c'est son tour
    const validPurchases = allPurchases.filter((purchase) => {
      // Vérifier que validationWorkflows existe
      if (
        !purchase.validationWorkflows ||
        purchase.validationWorkflows.length === 0
      )
        return false;

      // Trouver le workflow du step actuel
      const currentWorkflow = purchase.validationWorkflows.find(
        (w) => w.step === purchase.currentStep,
      );

      if (!currentWorkflow) return false;

      const validators = currentWorkflow.validators;

      // Vérifier que validators existe
      if (!validators || validators.length === 0) return false;

      const nextValidator = validators
        .filter((v) => !v.isValidated)
        .sort((a, b) => a.order - b.order)[0];

      return nextValidator && nextValidator.role === userRole;
    });

    // Pagination sur les résultats filtrés
    const total = validPurchases.length;
    const paginatedPurchases = validPurchases.slice(skip, skip + limit);

    return {
      data: paginatedPurchases,
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
