import { Injectable } from '@nestjs/common';
import { Prisma, ValidatorRole } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { KpiQueryDto } from '../dto/kpi-query.dto';
import {
  toMonthKey,
  buildEmptyMonthlyMap,
  buildEmptyMonthlySeries,
  round1,
} from '../utils/date-utils';
import { sumBy, percentageOf, median } from '../../utils/data-helpers';

/** Délai cible de soumission : ~5 jours ouvrables exprimés en jours calendaires */
const SUBMISSION_TARGET_DAYS = 7;

@Injectable()
export class KpiService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllKpis(params: KpiQueryDto) {
    const dateTo = params.dateTo ? new Date(params.dateTo) : new Date();
    const dateFrom = params.dateFrom
      ? new Date(params.dateFrom)
      : new Date(dateTo.getTime() - 365 * 24 * 60 * 60 * 1000);

    const purchaseWhere: Prisma.PurchaseWhereInput = {
      createdAt: { gte: dateFrom, lte: dateTo },
      ...(params.region ? { region: params.region } : {}),
    };

    const [
      submissionDelay,
      buyerDelay,
      volumeByMarket,
      volumeByBuyerRegion,
      supplierEvaluation,
    ] = await Promise.all([
      this.getSubmissionDelay(purchaseWhere, dateFrom, dateTo),
      this.getBuyerDelay(
        purchaseWhere,
        params.buyerDelayGroupBy ?? 'marketType',
      ),
      this.getVolumeByMarket(purchaseWhere),
      this.getVolumeByBuyerRegion(purchaseWhere),
      this.getSupplierEvaluation(purchaseWhere, params.supplierId),
    ]);

    return {
      submissionDelay,
      buyerDelay,
      volumeByMarket,
      volumeByBuyerRegion,
      supplierEvaluation,
    };
  }

  // ---------------------------------------------------------------------------
  // KPI 1 — Délai de soumission DA
  // Calcule le délai entre Purchase.createdAt et la première ValidationWorkflow
  // (= première entrée dans le circuit d'approbation).
  // ---------------------------------------------------------------------------
  private async getSubmissionDelay(
    purchaseWhere: Prisma.PurchaseWhereInput,
    dateFrom: Date,
    dateTo: Date,
  ) {
    const purchases = await this.prisma.purchase.findMany({
      where: {
        ...purchaseWhere,
        validationWorkflows: { some: {} },
      },
      select: {
        createdAt: true,
        validationWorkflows: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    });

    type DelayEntry = { days: number; month: string };
    const delays: DelayEntry[] = [];

    for (const p of purchases) {
      if (!p.validationWorkflows.length) continue;
      const diffMs =
        p.validationWorkflows[0].createdAt.getTime() - p.createdAt.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays < 0) continue; // garde contre les anomalies de données
      delays.push({
        days: diffDays,
        month: toMonthKey(p.createdAt),
      });
    }

    if (!delays.length) {
      return {
        avgDelayDays: 0,
        medianDelayDays: 0,
        complianceRate: 0,
        monthlySeries: buildEmptyMonthlySeries(dateTo),
      };
    }

    const allDays = delays.map((d) => d.days);
    const avgDelayDays = sumBy(delays, (d) => d.days) / allDays.length;
    const sorted = [...allDays].sort((a, b) => a - b);
    const medianDelayDays = median(sorted);
    const complianceRate = percentageOf(
      allDays,
      (d) => d <= SUBMISSION_TARGET_DAYS,
    );

    const monthlyMap = buildEmptyMonthlyMap(dateTo);
    for (const { days, month } of delays) {
      const entry = monthlyMap.get(month);
      if (entry) {
        entry.total += days;
        entry.count += 1;
      }
    }

    const monthlySeries = Array.from(monthlyMap.entries()).map(
      ([month, { total, count }]) => ({
        month,
        avgDelay: count > 0 ? round1(total / count) : 0,
        count,
      }),
    );

    return {
      avgDelayDays: round1(avgDelayDays),
      medianDelayDays: round1(medianDelayDays),
      complianceRate: round1(complianceRate),
      monthlySeries,
    };
  }

  // ---------------------------------------------------------------------------
  // KPI 2 — Délai de traitement acheteur par type d'achat / type de marché
  // Délai = Validator.validatedAt - Validator.createdAt pour les ACHETEUR validés.
  // ---------------------------------------------------------------------------
  private async getBuyerDelay(
    purchaseWhere: Prisma.PurchaseWhereInput,
    groupBy: 'marketType' | 'operationType',
  ) {
    const validators = await this.prisma.validator.findMany({
      where: {
        role: ValidatorRole.ACHETEUR,
        isValidated: true,
        validatedAt: { not: null },
        workflow: { purchase: purchaseWhere },
      },
      select: {
        createdAt: true,
        validatedAt: true,
        workflow: {
          select: {
            purchase: {
              select: { marketType: true, operationType: true },
            },
          },
        },
      },
    });

    const groupMap = new Map<string, { total: number; count: number }>();

    for (const v of validators) {
      if (!v.validatedAt) continue;
      const diffDays =
        (v.validatedAt.getTime() - v.createdAt.getTime()) /
        (1000 * 60 * 60 * 24);
      if (diffDays < 0) continue;

      const category =
        groupBy === 'marketType'
          ? v.workflow.purchase.marketType?.trim() || 'Non classifié'
          : String(v.workflow.purchase.operationType);

      const entry = groupMap.get(category) ?? { total: 0, count: 0 };
      entry.total += diffDays;
      entry.count += 1;
      groupMap.set(category, entry);
    }

    return {
      series: Array.from(groupMap.entries()).map(
        ([category, { total, count }]) => ({
          category,
          avgDelayDays: round1(total / count),
          count,
        }),
      ),
    };
  }

  // ---------------------------------------------------------------------------
  // KPI 3 — Volume d'achat par type de marché
  // Somme de PurchaseItem.amount groupée par Purchase.marketType.
  // Normalisation : trim + lowercase pour dédoublonner les valeurs libres.
  // ---------------------------------------------------------------------------
  private async getVolumeByMarket(purchaseWhere: Prisma.PurchaseWhereInput) {
    const purchases = await this.prisma.purchase.findMany({
      where: purchaseWhere,
      select: {
        marketType: true,
        items: { select: { amount: true } },
      },
    });

    const marketMap = new Map<
      string,
      { displayName: string; totalAmount: number; count: number }
    >();

    for (const p of purchases) {
      // Clé normalisée pour le dédoublonnage
      const key = p.marketType?.trim().toLowerCase() || 'non classifié';
      // Nom d'affichage : on garde la première occurrence non vide
      const displayName = p.marketType?.trim() || 'Non classifié';
      const purchaseTotal = sumBy(p.items, (item) => item.amount);

      const entry = marketMap.get(key) ?? {
        displayName,
        totalAmount: 0,
        count: 0,
      };
      entry.totalAmount += purchaseTotal;
      entry.count += 1;
      marketMap.set(key, entry);
    }

    const total = sumBy(Array.from(marketMap.values()), (e) => e.totalAmount);

    const items = Array.from(marketMap.values()).map((e) => ({
      marketType: e.displayName,
      totalAmount: e.totalAmount,
      count: e.count,
      percentage: total > 0 ? round1((e.totalAmount / total) * 100) : 0,
    }));

    return { total, items };
  }

  // ---------------------------------------------------------------------------
  // KPI 4 — Volume d'achat par acheteur / région
  // Acheteur = Validator de rôle ACHETEUR ayant validé.
  // Région inconnue → "Autre" (résolution frontend via MADAGASCAR_REGIONS).
  // ---------------------------------------------------------------------------
  private async getVolumeByBuyerRegion(
    purchaseWhere: Prisma.PurchaseWhereInput,
  ) {
    const validators = await this.prisma.validator.findMany({
      where: {
        role: ValidatorRole.ACHETEUR,
        isValidated: true,
        workflow: { purchase: purchaseWhere },
      },
      select: {
        name: true,
        workflow: {
          select: {
            purchase: {
              select: {
                region: true,
                items: { select: { amount: true } },
              },
            },
          },
        },
      },
    });

    const buyerMap = new Map<
      string,
      Map<string, { totalAmount: number; count: number }>
    >();

    for (const v of validators) {
      const buyerName = v.name || 'Non assigné';
      const region = v.workflow.purchase.region?.trim() || 'Autre';
      const purchaseTotal = v.workflow.purchase.items.reduce(
        (sum, item) => sum + item.amount,
        0,
      );

      if (!buyerMap.has(buyerName)) buyerMap.set(buyerName, new Map());
      const regionMap = buyerMap.get(buyerName)!;
      const entry = regionMap.get(region) ?? { totalAmount: 0, count: 0 };
      entry.totalAmount += purchaseTotal;
      entry.count += 1;
      regionMap.set(region, entry);
    }

    const buyers = Array.from(buyerMap.entries()).map(
      ([buyerName, regionMap]) => ({
        buyerName,
        regions: Array.from(regionMap.entries()).map(
          ([region, { totalAmount, count }]) => ({
            region,
            totalAmount,
            count,
          }),
        ),
      }),
    );

    return { buyers };
  }

  // ---------------------------------------------------------------------------
  // KPI 5 — Évaluation fournisseur
  // Jointure : SatisfactionSurvey → Purchase → PV → PVSupplier → Supplier.
  // Score de conformité = ratio des champs renseignés parmi
  // regulariteFiscale, devisSpecifications, conformiteSpecs.
  // ---------------------------------------------------------------------------
  private async getSupplierEvaluation(
    purchaseWhere: Prisma.PurchaseWhereInput,
    supplierId?: string,
  ) {
    const purchases = await this.prisma.purchase.findMany({
      where: {
        ...purchaseWhere,
        satisfactionSurvey: { isNot: null },
        pv: { isNot: null },
      },
      select: {
        satisfactionSurvey: {
          select: {
            rating: true,
            deliveryRating: true,
            qualityRating: true,
            serviceRating: true,
          },
        },
        pv: {
          select: {
            suppliers: {
              where: supplierId
                ? { supplierId }
                : { supplierId: { not: null } },
              select: {
                supplierId: true,
                regulariteFiscale: true,
                devisSpecifications: true,
                conformiteSpecs: true,
                supplier: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    type SupplierAgg = {
      name: string;
      ratings: number[];
      deliveryRatings: number[];
      qualityRatings: number[];
      serviceRatings: number[];
      complianceScores: number[];
    };
    const supplierMap = new Map<string, SupplierAgg>();

    for (const p of purchases) {
      if (!p.satisfactionSurvey || !p.pv) continue;
      const { rating, deliveryRating, qualityRating, serviceRating } =
        p.satisfactionSurvey;

      for (const pvs of p.pv.suppliers) {
        if (!pvs.supplierId || !pvs.supplier) continue;
        const sid = pvs.supplierId;

        if (!supplierMap.has(sid)) {
          supplierMap.set(sid, {
            name: pvs.supplier.name,
            ratings: [],
            deliveryRatings: [],
            qualityRatings: [],
            serviceRatings: [],
            complianceScores: [],
          });
        }
        const entry = supplierMap.get(sid)!;
        entry.ratings.push(rating);
        if (deliveryRating != null) entry.deliveryRatings.push(deliveryRating);
        if (qualityRating != null) entry.qualityRatings.push(qualityRating);
        if (serviceRating != null) entry.serviceRatings.push(serviceRating);

        // Score de conformité documentaire
        const fields = [
          pvs.regulariteFiscale,
          pvs.devisSpecifications,
          pvs.conformiteSpecs,
        ];
        const filled = fields.filter((f) => f != null && f !== '').length;
        entry.complianceScores.push(filled / fields.length);
      }
    }

    const avg = (arr: number[]) =>
      arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const suppliers = Array.from(supplierMap.entries()).map(([id, e]) => ({
      id,
      name: e.name,
      globalRating: round1(avg(e.ratings)),
      deliveryRating: round1(avg(e.deliveryRatings)),
      qualityRating: round1(avg(e.qualityRatings)),
      serviceRating: round1(avg(e.serviceRatings)),
      complianceScore: round1(avg(e.complianceScores) * 100),
      evaluationCount: e.ratings.length,
    }));

    return { suppliers };
  }
}
