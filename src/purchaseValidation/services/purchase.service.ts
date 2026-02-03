import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { FilterPurchaseDto } from '../dto/filter-purchase.dto';
import { ValidatePurchaseDto } from '../dto/validate-purchase.dto';
import { RejectPurchaseDto } from '../dto/reject-purchase.dto';
import { RequestChangesDto } from '../dto/request-change.dto';

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

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      throw new NotFoundException(`Utilisateur non trouvé.`);
    }

    const where: any = {
      status: 'PUBLISHED',
      validationWorkflow: {
        validators: {
          some: {
            role: user.role as any,
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
  async validatePurchase(
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
          decision: 'VALIDATED',
          comment: validateDto.comment,
          userId: userId,
          name: user.name,
          email: user.email,
        },
      });

      //mise a jour de la DA et passage à QR
      const updatedPurchase = await prisma.purchase.update({
        where: { id: purchaseId },
        data: {
          status: 'VALIDATED',
          currentStep: 'QR',
          validatedAt: new Date(),
        },
        include: {
          creator: true,
          items: true,
          validationWorkflow: {
            include: {
              validators: {
                include: { user: true },
                orderBy: { order: 'asc' },
              },
            },
          },
        },
      });

      if (purchase.validationWorkflow) {
        await prisma.validationWorkflow.update({
          where: { id: purchase.validationWorkflow.id },
          data: { isComplete: true },
        });
      }

      // creation d'un audit log
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'VALIDATE_PURCHASE',
          resource: 'PURCHASE',
          resourceId: purchaseId,
          details: {
            decision: 'VALIDATED',
            comment: validateDto.comment,
            validatorRole: user.role,
            previousStatus: 'PUBLISHED',
            newStatus: 'VALIDATED',
            newStep: 'QR',
          },
        },
      });

      return updatedPurchase;
    });
  }

  async requestChanges(
    purchaseId: string,
    userId: number,
    requestChangesDto: RequestChangesDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, name: true, email: true },
    });

    if (!user) {
      throw new ForbiddenException(`Utilisateur introuvable`);
    }

    const purchase = await this.findOne(purchaseId);

    if (purchase.status !== 'PUBLISHED') {
      throw new BadRequestException(
        `cette DA n'est pas en attente de validation`,
      );
    }

    if (!purchase.validationWorkflow) {
      throw new NotFoundException(`cette DA n'a pas de workflow de validation`);
    }

    const authorizedValidator = purchase.validationWorkflow.validators.find(
      (v) => v.role === user.role && !v.isValidated,
    );

    if (!authorizedValidator) {
      throw new ForbiddenException(
        `Vous n'etes pas autorisé à faire cette action`,
      );
    }

    // voici le tranaction de rejet
    return this.prisma.$transaction(async (prisma) => {
      await prisma.validator.update({
        where: { id: authorizedValidator.id },
        data: {
          isValidated: true,
          validatedAt: new Date(),
          decision: 'CHANGE_REQUESTED',
          comment: requestChangesDto.reason,
          userId: userId,
          name: user.name,
          email: user.email,
        },
      });

      const updatedPurchase = await prisma.purchase.update({
        where: { id: purchaseId },
        data: {
          status: 'CHANGE_REQUESTED',
          observations: requestChangesDto.reason,
          closedAt: new Date(),
        },
        include: {
          creator: true,
          items: true,
          validationWorkflow: {
            include: {
              validators: {
                include: { user: true },
                orderBy: { order: 'asc' },
              },
            },
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'CHANGE_REQUESTED',
          resource: 'PURCHASE',
          resourceId: purchaseId,
          details: {
            decision: 'REJECTED',
            comment: requestChangesDto.reason,
            validatorRole: user.role,
            previousStatus: 'PUBLISHED',
            newStatus: 'CHANGE_REQUESTED',
          },
        },
      });

      return updatedPurchase;
    });
  }

  async rejectPurchase(
    purchaseId: string,
    userId: number,
    rejectDto: RejectPurchaseDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, name: true, email: true },
    });

    if (!user) {
      throw new ForbiddenException(`Utilisateur introuvable`);
    }

    const purchase = await this.findOne(purchaseId);

    if (purchase.status !== 'PUBLISHED') {
      throw new BadRequestException(
        `cette DA n'est pas en attente de validation`,
      );
    }

    if (!purchase.validationWorkflow) {
      throw new NotFoundException(`cette DA n'a pas de workflow de validation`);
    }

    const authorizedValidator = purchase.validationWorkflow.validators.find(
      (v) => v.role === user.role && v.isValidated,
    );

    if (!authorizedValidator) {
      throw new ForbiddenException(
        `vous n'etes pas autorisé à rejeter cette demande`,
      );
    }

    return this.prisma.$transaction(async (prisma) => {
      await prisma.validator.update({
        where: { id: authorizedValidator.id },
        data: {
          isValidated: true,
          validatedAt: new Date(),
          decision: 'REJECTED',
          comment: rejectDto.comment,
          userId: userId,
          name: user.name,
          email: user.email,
        },
      });

      const updatedPurchase = await prisma.purchase.update({
        where: { id: purchaseId },
        data: {
          status: 'REJECTED',
          observations: rejectDto.comment,
          closedAt: new Date(),
        },
        include: {
          creator: true,
          items: true,
          validationWorkflow: {
            include: {
              validators: {
                include: { user: true },
                orderBy: { order: 'asc' },
              },
            },
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
