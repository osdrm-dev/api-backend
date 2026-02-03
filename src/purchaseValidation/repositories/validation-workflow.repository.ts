import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { ValidationWorkflow, Prisma } from '@prisma/client';

// Type pour ValidationWorkflow avec toutes les relations
export type ValidationWorkflowWithRelations = ValidationWorkflow & {
  validators: any[];
  purchase?: any;
};

/**
 * Repository pour gérer l'accès aux données ValidationWorkflow
 */
@Injectable()
export class ValidationWorkflowRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Include standard pour les workflows
   */
  private readonly standardInclude: Prisma.ValidationWorkflowInclude = {
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
    purchase: true,
  };

  /**
   * Trouve un workflow par ID
   */
  async findById(id: string): Promise<ValidationWorkflowWithRelations | null> {
    return this.prisma.validationWorkflow.findUnique({
      where: { id },
      include: this.standardInclude,
    }) as Promise<ValidationWorkflowWithRelations | null>;
  }

  /**
   * Trouve un workflow par Purchase ID
   */
  async findByPurchaseId(
    purchaseId: string,
  ): Promise<ValidationWorkflowWithRelations | null> {
    return this.prisma.validationWorkflow.findUnique({
      where: { purchaseId },
      include: this.standardInclude,
    }) as Promise<ValidationWorkflowWithRelations | null>;
  }

  /**
   * Trouve plusieurs workflows
   */
  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.ValidationWorkflowWhereInput;
    orderBy?: Prisma.ValidationWorkflowOrderByWithRelationInput;
  }): Promise<ValidationWorkflowWithRelations[]> {
    const { skip, take, where, orderBy } = params;

    return this.prisma.validationWorkflow.findMany({
      skip,
      take,
      where,
      orderBy,
      include: this.standardInclude,
    }) as Promise<ValidationWorkflowWithRelations[]>;
  }

  /**
   * Crée un workflow
   */
  async create(
    data: Prisma.ValidationWorkflowCreateInput,
  ): Promise<ValidationWorkflowWithRelations> {
    return this.prisma.validationWorkflow.create({
      data,
      include: this.standardInclude,
    }) as Promise<ValidationWorkflowWithRelations>;
  }

  /**
   * Met à jour un workflow
   */
  async update(params: {
    where: Prisma.ValidationWorkflowWhereUniqueInput;
    data: Prisma.ValidationWorkflowUpdateInput;
  }): Promise<ValidationWorkflowWithRelations> {
    const { where, data } = params;

    return this.prisma.validationWorkflow.update({
      where,
      data,
      include: this.standardInclude,
    }) as Promise<ValidationWorkflowWithRelations>;
  }

  /**
   * Supprime un workflow
   */
  async delete(
    where: Prisma.ValidationWorkflowWhereUniqueInput,
  ): Promise<ValidationWorkflow> {
    return this.prisma.validationWorkflow.delete({ where });
  }

  /**
   * Compte les workflows
   */
  async count(where?: Prisma.ValidationWorkflowWhereInput): Promise<number> {
    return this.prisma.validationWorkflow.count({ where });
  }

  /**
   * Trouve les workflows complets
   */
  async findCompleted(): Promise<ValidationWorkflowWithRelations[]> {
    return this.findMany({
      where: { isComplete: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Trouve les workflows en cours
   */
  async findPending(): Promise<ValidationWorkflowWithRelations[]> {
    return this.findMany({
      where: { isComplete: false },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Met à jour le currentStep
   */
  async updateStep(params: {
    id: string;
    currentStep: number;
  }): Promise<ValidationWorkflowWithRelations> {
    const { id, currentStep } = params;

    return this.update({
      where: { id },
      data: { currentStep },
    });
  }

  /**
   * Marque un workflow comme complet
   */
  async markAsComplete(id: string): Promise<ValidationWorkflowWithRelations> {
    return this.update({
      where: { id },
      data: {
        isComplete: true,
        currentStep: 999, // Marqueur de fin
      },
    });
  }

  /**
   * Réinitialise un workflow
   */
  async reset(id: string): Promise<ValidationWorkflowWithRelations> {
    return this.update({
      where: { id },
      data: {
        currentStep: 0,
        isComplete: false,
      },
    });
  }
}
