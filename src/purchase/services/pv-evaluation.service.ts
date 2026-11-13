import { HttpStatus, Injectable } from '@nestjs/common';
import {
  PVEvaluationStatus,
  PurchaseStatus,
  PurchaseStep,
  Role,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AppException, ErrorCode } from 'src/common/errors';
import { NotificationService } from 'src/notification/services/nofitication.service';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';
import { getExpectedEvaluatorIds } from '../utils/pv-evaluators';
import {
  PVAnswers,
  findAnswersError,
  findCommentsError,
  isEvaluationComplete,
} from '../utils/pv-criteria';
import {
  SavePVEvaluationDto,
  WaivePVEvaluationDto,
} from '../dto/pv-evaluation.dto';

const EMPTY_GRID = { status: 'DRAFT', answers: {}, criteriaComments: {} };
const USER_SELECT = { id: true, name: true, role: true } as const;

@Injectable()
export class PVEvaluationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  private async load(purchaseId: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        acheteur: { select: { ...USER_SELECT, email: true } },
        validationWorkflows: {
          where: { step: PurchaseStep.DA },
          include: {
            validators: {
              include: { user: { select: { ...USER_SELECT, email: true } } },
            },
          },
        },
        pv: {
          include: {
            suppliers: true,
            evaluations: { include: { user: { select: USER_SELECT } } },
          },
        },
      },
    });
    if (!purchase?.pv) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.NOT_FOUND,
        'PV not found for this purchase',
      );
    }
    const pv = purchase.pv;
    const validators = purchase.validationWorkflows.flatMap(
      (w) => w.validators,
    );
    const expected = getExpectedEvaluatorIds({
      daEvaluationsRequired: pv.daEvaluationsRequired,
      acheteurId: purchase.acheteurId,
      daValidators: validators,
    });
    const supplierIds = pv.suppliers
      .map((s) => s.supplierId)
      .filter((id): id is string => !!id);
    const users = new Map<
      number,
      { name: string; role: Role; email?: string | null }
    >();
    if (purchase.acheteur) users.set(purchase.acheteur.id, purchase.acheteur);
    validators.forEach((v) => v.user && users.set(v.user.id, v.user));
    return { purchase, pv, expected, supplierIds, users };
  }

  private assertPublished(purchase: { status: PurchaseStatus }) {
    if (purchase.status !== PurchaseStatus.PUBLISHED) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_PV_LOCKED,
        'PV can no longer be modified because it was already submitted',
      );
    }
  }

  // Common guard for the evaluator's own routes.
  private async loadForEvaluator(purchaseId: string, userId: number) {
    const ctx = await this.load(purchaseId);
    this.assertPublished(ctx.purchase);
    if (!ctx.expected.includes(userId)) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.PURCHASE_PV_NOT_EVALUATOR,
        'User is not an evaluator of this PV',
      );
    }
    const mine = ctx.pv.evaluations.find((e) => e.userId === userId) ?? null;
    return { ...ctx, mine };
  }

  private assertEditable(mine: { status: PVEvaluationStatus } | null) {
    if (mine && mine.status !== PVEvaluationStatus.DRAFT) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_PV_EVALUATION_SUBMITTED,
        'Evaluation already submitted',
      );
    }
  }

  async getMine(purchaseId: string, userId: number) {
    const { mine } = await this.loadForEvaluator(purchaseId, userId);
    return mine ?? { ...EMPTY_GRID };
  }

  async saveMine(purchaseId: string, userId: number, dto: SavePVEvaluationDto) {
    const { pv, supplierIds, mine } = await this.loadForEvaluator(
      purchaseId,
      userId,
    );
    this.assertEditable(mine);
    const error =
      (dto.answers !== undefined &&
        findAnswersError(dto.answers, supplierIds)) ||
      (dto.criteriaComments !== undefined &&
        findCommentsError(dto.criteriaComments));
    if (error) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_PV_EVALUATION_INVALID,
        error,
      );
    }
    const data = {
      ...(dto.answers !== undefined && { answers: dto.answers }),
      ...(dto.criteriaComments !== undefined && {
        criteriaComments: dto.criteriaComments,
      }),
      status: PVEvaluationStatus.DRAFT,
    };
    return this.prisma.pVEvaluation.upsert({
      where: { pvId_userId: { pvId: pv.id, userId } },
      create: { pvId: pv.id, userId, ...data },
      update: data,
    });
  }

  async submitMine(purchaseId: string, userId: number) {
    const { pv, supplierIds, mine } = await this.loadForEvaluator(
      purchaseId,
      userId,
    );
    this.assertEditable(mine);
    if (
      !isEvaluationComplete((mine?.answers as PVAnswers) ?? null, supplierIds)
    ) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_PV_EVALUATION_INCOMPLETE,
        'Evaluation grid is incomplete',
      );
    }
    const result = await this.prisma.pVEvaluation.update({
      where: { pvId_userId: { pvId: pv.id, userId } },
      data: { status: PVEvaluationStatus.SUBMITTED, submittedAt: new Date() },
    });
    await this.notifyIfComplete(purchaseId);
    return result;
  }

  private rows(ctx: Awaited<ReturnType<PVEvaluationService['load']>>) {
    const byUser = new Map(ctx.pv.evaluations.map((e) => [e.userId, e]));
    const evaluators = ctx.expected.map((id) => ({
      userId: id,
      name: ctx.users.get(id)?.name ?? null,
      role: ctx.users.get(id)?.role ?? null,
      status: byUser.get(id)?.status ?? 'PENDING',
    }));
    const done = evaluators.filter(
      (e) => e.status === 'SUBMITTED' || e.status === 'WAIVED',
    ).length;
    return { expected: evaluators.length, done, evaluators };
  }

  private assertCanView(
    ctx: { purchase: { acheteurId: number | null }; expected: number[] },
    user: { id: number; role: Role },
    allowEvaluator: boolean,
  ) {
    const ok =
      user.role === Role.ADMIN ||
      ctx.purchase.acheteurId === user.id ||
      (allowEvaluator && ctx.expected.includes(user.id));
    if (!ok) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.PURCHASE_PV_NOT_EVALUATOR,
        'Not allowed to view PV evaluations',
      );
    }
  }

  async getStatus(purchaseId: string, user: { id: number; role: Role }) {
    const ctx = await this.load(purchaseId);
    this.assertCanView(ctx, user, true);
    return this.rows(ctx);
  }

  async listAll(purchaseId: string, user: { id: number; role: Role }) {
    const ctx = await this.load(purchaseId);
    this.assertCanView(ctx, user, false);
    return {
      ...this.rows(ctx),
      evaluations: ctx.pv.evaluations.filter((e) =>
        ctx.expected.includes(e.userId),
      ),
    };
  }

  async waive(
    purchaseId: string,
    admin: { id: number; role: Role },
    targetUserId: number,
    dto: WaivePVEvaluationDto,
  ) {
    if (admin.role !== Role.ADMIN) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.PURCHASE_PV_NOT_EVALUATOR,
        'Only an admin can waive an evaluation',
      );
    }
    const { purchase, pv, expected } = await this.load(purchaseId);
    this.assertPublished(purchase);
    const existing = pv.evaluations.find((e) => e.userId === targetUserId);
    if (
      !expected.includes(targetUserId) ||
      existing?.status === PVEvaluationStatus.SUBMITTED
    ) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_PV_EVALUATION_INVALID,
        'Target is not an expected evaluator or has already submitted',
      );
    }
    const data = {
      status: PVEvaluationStatus.WAIVED,
      waivedById: admin.id,
      waivedReason: dto.reason,
    };
    const result = await this.prisma.pVEvaluation.upsert({
      where: { pvId_userId: { pvId: pv.id, userId: targetUserId } },
      create: { pvId: pv.id, userId: targetUserId, ...data },
      update: data,
    });
    await this.notifyIfComplete(purchaseId);
    return result;
  }

  async getExpectedEvaluatorUsers(purchaseId: string) {
    const { expected, users, purchase } = await this.load(purchaseId);
    return {
      reference: purchase.reference,
      users: expected.map((id) => ({
        id,
        email: users.get(id)?.email ?? null,
      })),
    };
  }

  async assertAllDone(purchaseId: string) {
    const { done, expected } = this.rows(await this.load(purchaseId));
    if (done < expected) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.PURCHASE_PV_EVALUATIONS_INCOMPLETE,
        'All expected PV evaluations must be submitted or waived',
      );
    }
  }

  // Suppliers changed: non-waived grids go back to DRAFT without removed suppliers.
  async resetAfterSupplierChange(pvId: string, keptSupplierIds: string[]) {
    const evaluations = await this.prisma.pVEvaluation.findMany({
      where: { pvId, status: { not: PVEvaluationStatus.WAIVED } },
    });
    await Promise.all(
      evaluations.map((e) => {
        const answers = Object.fromEntries(
          Object.entries((e.answers as PVAnswers) ?? {}).filter(([id]) =>
            keptSupplierIds.includes(id),
          ),
        );
        return this.prisma.pVEvaluation.update({
          where: { id: e.id },
          data: {
            status: PVEvaluationStatus.DRAFT,
            submittedAt: null,
            answers,
          },
        });
      }),
    );
  }

  private async notifyIfComplete(purchaseId: string) {
    const ctx = await this.load(purchaseId);
    const { done, expected } = this.rows(ctx);
    const email = ctx.purchase.acheteur?.email;
    if (expected > 0 && done === expected && email) {
      await this.notificationService.createNotification(
        OSDRM_PROCESS_EVENT.PV_EVALUATIONS_COMPLETE,
        [email],
        purchaseId,
        { reference: ctx.purchase.reference },
      );
    }
  }
}
