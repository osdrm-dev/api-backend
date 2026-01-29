import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { FilterPurchaseDto } from '../dto/filter-purchase.dto';
import {
  ValidatePurchaseDto,
  ValidationDecision,
} from '../dto/validate-purchase.dto';

@Injectable()
export class PurchaseService {
  constructor(private prisma: PrismaService) {}

  async findAllForValidator(userId: number, filters: FilterPurchaseDto) {
    const {
      page = 1,
      Limit = 10,
      sortBy = 'createdAt',
      sortByOrder = 'desc',
      ...filterParams
    } = filters;
    const skip = (page - 1) * Limit;

    const where: any = {
      validationWorkflow: {
        validators: {
          some: {
            userId: userId,
            isValidated: false,
          },
        },
      },
    };

    if (filterParams.status) {
      where.status = filterParams.status;
    }

    if (filterParams.step) {
      where.step = filterParams.step;
    }

    if (filterParams.project) {
      where.project = { contains: filterParams.project, mode: 'insensitive' };
    }

    if (filterParams.region) {
      where.region = { contains: filterParams.region, mode: 'insensitive' };
    }

    if (filterParams.search) {
      where.OR = [
        { reference: { contains: filterParams.search, mode: 'insensitive' } },
        { title: { contains: filterParams.search, mode: 'insensitive' } },
        { description: { contains: filterParams.search, mode: 'insensitive' } },
      ];
    }

    const [purchases, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        include: {
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
        },
        skip,
        take: Limit,
        orderBy: { [sortBy]: sortByOrder },
      }),
      (this.prisma as any).purchase.count({ where }),
    ]);

    return {
      data: purchases,
      pagination: {
        total,
        page,
        Limit,
        totalPages: Math.ceil(total / Limit),
      },
    };
  }

  /* ici c'est la fonction pour recuperer une demande d'achat par id */

  async findOne(id: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: {
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
      },
    });

    if (!purchase) {
      throw new NotFoundException(`Demande d'achat #${id} non trouvée.`);
    }

    return purchase;
  }

  //valider une demande d'achat ainsi que verifier que l'utilisateur est bien le validateur actuel dans le workflow
  async validate(
    purchaseId: string,
    userId: number,
    validateDto: ValidatePurchaseDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, name: true, email: true },
    });

    if (!user) {
      throw new NotFoundException(`Utilisateur non trouvé.`);
    }

    const purchase = await this.findOne(purchaseId);

    //ici on verifiw l'etat des demandes d'achat
    if (purchase.status !== 'PUBLISHED') {
      throw new BadRequestException(
        `La demande #${purchaseId} n'est pas en attente de validation (status doit etre 'PUBLISHED')`,
      );
    }

    if (!purchase.validationWorkflow) {
      throw new BadRequestException(
        `cette demande n'a pas de workflow de validation`,
      );
    }

    const authorizedValidator = purchase.validationWorkflow.validators.find(
      (v) => v.role === user.role && v.isValidated === false,
    );

    if (!authorizedValidator) {
      throw new ForbiddenException(
        `Vous n'êtes pas autorisé à valider cette demande. Role requis parmis les validateurs autorisés.`,
      );
    }

    //Effectuer la validation dans une transaction
    return this.prisma.$transaction(async (prisma) => {
      // mis a jour du validateur qui effectue la validation
      await prisma.validator.update({
        where: { id: authorizedValidator.id },
        data: {
          isValidated: true,
          validatedAt: new Date(),
          decision: validateDto.decision,
          comment: validateDto.comment,
          userId: userId,
          name: user.name,
          email: user.email,
        },
      });

      let newStatus: any;
      let currentStep: any = purchase.currentStep;

      if (validateDto.decision === ValidationDecision.VALIDATED) {
        newStatus = 'VALIDATED';
        currentStep = 'QR';
      } else if (validateDto.decision === ValidationDecision.REJECTED) {
        newStatus = 'REJECTED';
      } else if (validateDto.decision === ValidationDecision.CHANGE_REQUESTED) {
        newStatus = 'CHANGE_REQUESTED';
      }

      //mettre a jour la demande d'achat avec le nouveau statut et l'etape actuelle
      const updatedPurchase = await prisma.purchase.update({
        where: { id: purchaseId },
        data: {
          status: newStatus,
          currentStep: currentStep,
          validatedAt:
            validateDto.decision === ValidationDecision.VALIDATED
              ? new Date()
              : null,
        },
        include: {
          creator: true,
          items: true,
          validationWorkflow: {
            include: {
              validators: {
                include: {
                  user: true,
                },
                orderBy: { order: 'asc' },
              },
            },
          },
        },
      });

      //Mettre a jour le workflow comme complet si approuvé ou rejeté
      if (
        validateDto.decision === ValidationDecision.VALIDATED ||
        (validateDto.decision === ValidationDecision.REJECTED &&
          purchase.validationWorkflow !== null)
      ) {
        await prisma.validationWorkflow.update({
          where: { id: purchase.validationWorkflow!.id },
          data: { isComplete: true },
        });
      }

      //creation d'un log d'audit
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'VALIDATE_PURCHASE',
          resource: 'purchase',
          resourceId: purchaseId,
          details: {
            decision: validateDto.decision,
            comment: validateDto.comment,
            validatorRole: user.role,
            newStatus: newStatus,
            currentStep: currentStep,
          },
        },
      });

      return updatedPurchase;
    });
  }

  async findAllByUser(userId: number, filters: FilterPurchaseDto) {
    const {
      page = 1,
      Limit = 10,
      sortBy = 'createdAt',
      sortByOrder = 'desc',
      ...filterParams
    } = filters;
    const skip = (page - 1) * Limit;

    const where: any = {
      creatorId: { id: userId },
    };

    if (filterParams.status) {
      where.status = filterParams.status;
    }

    if (filterParams.step) {
      where.step = filterParams.step;
    }

    const [purchases, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        include: {
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
                    },
                  },
                },
                orderBy: { order: 'asc' },
              },
            },
          },
        },
        skip,
        take: Limit,
        orderBy: { [sortBy]: sortByOrder },
      }),
      this.prisma.purchase.count({ where }),
    ]);

    return {
      data: purchases,
      pagination: {
        total,
        page,
        Limit,
        totalPages: Math.ceil(total / Limit),
      },
    };
  }

  // Historiques des validations
  async getValidationHistory(userId: number, filters: FilterPurchaseDto) {
    const { page = 1, Limit = 10 } = filters;
    const skip = (page - 1) * Limit;

    const [validations, total] = await Promise.all([
      this.prisma.validator.findMany({
        where: {
          userId: userId,
          isValidated: true,
        },
        include: {
          workflow: {
            include: {
              purchase: {
                include: {
                  creator: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
        skip,
        take: Limit,
        orderBy: { validatedAt: 'desc' },
      }),

      this.prisma.validator.count({
        where: {
          userId: userId,
          isValidated: true,
        },
      }),
    ]);

    return {
      data: validations.map((v) => ({
        id: v.id,
        decision: v.decision,
        comment: v.comment,
        validatedAt: v.validatedAt,
        role: v.role,
        purchase: v.workflow.purchase,
      })),
      pagination: {
        total,
        page,
        Limit,
        totalPages: Math.ceil(total / Limit),
      },
    };
  }
}
