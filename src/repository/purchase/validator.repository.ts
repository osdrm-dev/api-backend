import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Validator, Prisma, ValidatorRole } from '@prisma/client';

/**
 * Repository pour gérer l'accès aux données Validator
 */
@Injectable()
export class ValidatorRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Include standard pour les validateurs
   */
  private readonly standardInclude: Prisma.ValidatorInclude = {
    user: {
      select: {
        id: true,
        name: true,
        email: true,
        fonction: true,
      },
    },
    workflow: {
      include: {
        purchase: true,
      },
    },
  };

  /**
   * Trouve un validateur par ID
   */
  async findById(id: string): Promise<Validator | null> {
    return this.prisma.validator.findUnique({
      where: { id },
      include: this.standardInclude,
    });
  }

  /**
   * Trouve plusieurs validateurs
   */
  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.ValidatorWhereInput;
    orderBy?: Prisma.ValidatorOrderByWithRelationInput;
  }): Promise<Validator[]> {
    const { skip, take, where, orderBy } = params;

    return this.prisma.validator.findMany({
      skip,
      take,
      where,
      orderBy,
      include: this.standardInclude,
    });
  }

  /**
   * Crée un validateur
   */
  async create(data: Prisma.ValidatorCreateInput): Promise<Validator> {
    return this.prisma.validator.create({
      data,
      include: this.standardInclude,
    });
  }

  /**
   * Crée plusieurs validateurs
   */
  async createMany(data: Prisma.ValidatorCreateManyInput[]): Promise<number> {
    const result = await this.prisma.validator.createMany({
      data,
      skipDuplicates: true,
    });
    return result.count;
  }

  /**
   * Met à jour un validateur
   */
  async update(params: {
    where: Prisma.ValidatorWhereUniqueInput;
    data: Prisma.ValidatorUpdateInput;
  }): Promise<Validator> {
    const { where, data } = params;

    return this.prisma.validator.update({
      where,
      data,
      include: this.standardInclude,
    });
  }

  /**
   * Met à jour plusieurs validateurs
   */
  async updateMany(params: {
    where: Prisma.ValidatorWhereInput;
    data: Prisma.ValidatorUpdateManyMutationInput;
  }): Promise<number> {
    const { where, data } = params;
    const result = await this.prisma.validator.updateMany({ where, data });
    return result.count;
  }

  /**
   * Supprime un validateur
   */
  async delete(where: Prisma.ValidatorWhereUniqueInput): Promise<Validator> {
    return this.prisma.validator.delete({ where });
  }

  /**
   * Compte les validateurs
   */
  async count(where?: Prisma.ValidatorWhereInput): Promise<number> {
    return this.prisma.validator.count({ where });
  }

  /**
   * Trouve les validateurs d'un workflow
   */
  async findByWorkflow(workflowId: string): Promise<Validator[]> {
    return this.findMany({
      where: { workflowId },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Trouve les validateurs par utilisateur
   */
  async findByUser(userId: number): Promise<Validator[]> {
    return this.findMany({
      where: { userId },
      orderBy: { validatedAt: 'desc' },
    });
  }

  /**
   * Trouve les validateurs validés par un utilisateur
   */
  async findValidatedByUser(userId: number): Promise<Validator[]> {
    return this.findMany({
      where: {
        userId,
        isValidated: true,
      },
      orderBy: { validatedAt: 'desc' },
    });
  }

  /**
   * Trouve les validateurs en attente pour un rôle
   */
  async findPendingByRole(role: ValidatorRole): Promise<Validator[]> {
    return this.findMany({
      where: {
        role,
        isValidated: false,
      },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Marque un validateur comme validé
   */
  async markAsValidated(params: {
    id: string;
    userId: number;
    decision: string;
    comment?: string;
    userName?: string;
    userEmail?: string;
  }): Promise<Validator> {
    const { id, userId, decision, comment, userName, userEmail } = params;

    return this.prisma.validator.update({
      where: { id },
      data: {
        isValidated: true,
        validatedAt: new Date(),
        userId,
        decision,
        comment,
        name: userName,
        email: userEmail,
      },
    });
  }

  /**
   * Réinitialise les validateurs d'un workflow
   */
  async resetByWorkflow(workflowId: string): Promise<number> {
    const result = this.prisma.validator.updateMany({
      where: { workflowId },
      data: {
        isValidated: false,
        validatedAt: null,
        decision: null,
        comment: null,
        userId: null,
        name: null,
        email: null,
      },
    });

    return (await result).count;
  }

  /**
   * Compte les validations par décision
   */
  async countByDecision(params: {
    userId?: number;
    decision: string;
  }): Promise<number> {
    const { userId, decision } = params;

    return this.count({
      userId,
      decision,
      isValidated: true,
    });
  }

  /**
   * Trouve l'historique de validations avec pagination
   */
  async findValidationHistory(params: {
    userId: number;
    skip?: number;
    take?: number;
  }): Promise<Validator[]> {
    const { userId, skip, take } = params;

    return this.findMany({
      skip,
      take,
      where: {
        userId,
        isValidated: true,
      },
      orderBy: { validatedAt: 'desc' },
    });
  }
}
