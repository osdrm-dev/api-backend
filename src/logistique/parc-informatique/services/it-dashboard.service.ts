import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { ItAttributionStatus, ItDemandStatus } from '@prisma/client';
import { ItDepreciationService } from './it-depreciation.service';

@Injectable()
export class ItDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly depreciationService: ItDepreciationService,
  ) {}

  async getDashboard() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      allAssets,
      allDemands,
      demandesEnAttenteRecent,
      newAttributions,
      newReturns,
      newPurchases,
    ] = await Promise.all([
      this.prisma.itAsset.findMany({
        where: { archivedAt: null },
        include: { category: true },
      }),
      this.prisma.itDemand.findMany({
        where: { status: ItDemandStatus.EN_ATTENTE },
        orderBy: { createdAt: 'asc' },
        take: 5,
        include: {
          requestor: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.itDemand.count({
        where: { status: ItDemandStatus.EN_ATTENTE },
      }),
      this.prisma.itAttribution.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.itAttribution.count({
        where: {
          status: ItAttributionStatus.RETOURNE,
          returnedAt: { gte: thirtyDaysAgo },
        },
      }),
      this.prisma.purchase.count({
        where: {
          createdAt: { gte: thirtyDaysAgo },
          data: {
            path: ['itAssetId'],
            not: 'undefined',
          },
        },
      }),
    ]);

    // KPIs
    const totalAssets = allAssets.length;
    const totalStockDisponible = allAssets.reduce(
      (sum, a) => sum + (a.quantiteTotal - a.quantiteAttribuee),
      0,
    );
    const enRupture = allAssets.filter(
      (a) => a.quantiteTotal - a.quantiteAttribuee <= a.seuilAlerte,
    ).length;
    const valeurTotale = allAssets.reduce(
      (sum, a) => sum + Number(a.purchasePrice) * a.quantiteTotal,
      0,
    );

    // Répartition par catégorie
    const categorieMap = new Map<string, { name: string; count: number }>();
    for (const asset of allAssets) {
      const key = asset.categoryId;
      const existing = categorieMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        categorieMap.set(key, {
          name: asset.category?.name ?? 'Inconnue',
          count: 1,
        });
      }
    }
    const repartitionCategorie = Array.from(categorieMap.values());

    // Répartition par état
    const etatMap = new Map<string, number>();
    for (const asset of allAssets) {
      etatMap.set(asset.status, (etatMap.get(asset.status) ?? 0) + 1);
    }
    const repartitionEtat = Array.from(etatMap.entries()).map(
      ([status, count]) => ({ status, count }),
    );

    // Stock critique
    const stockCritique = allAssets
      .filter((a) => a.quantiteTotal - a.quantiteAttribuee <= a.seuilAlerte)
      .slice(0, 10)
      .map((a) => ({
        id: a.id,
        designation: a.designation,
        stockDisponible: a.quantiteTotal - a.quantiteAttribuee,
        seuilAlerte: a.seuilAlerte,
        category: a.category?.name,
        location: a.location,
      }));

    // Demandes en attente
    const demandesEnAttente = {
      count: demandesEnAttenteRecent,
      oldest: allDemands.map((d) => ({
        id: d.id,
        reference: d.reference,
        desiredType: d.desiredType,
        requestor: d.requestor,
        anciennetéJours: Math.floor(
          (now.getTime() - d.createdAt.getTime()) / (1000 * 60 * 60 * 24),
        ),
      })),
    };

    // Vue financière via amortissement
    let totalVncCourante = 0;
    let totalDotationAnnuelle = 0;
    let countAmortis = 0;
    for (const asset of allAssets) {
      const duree =
        asset.depreciationOverrideYears ??
        asset.category?.depreciationYears ??
        3;
      const result = this.depreciationService.computeTable(
        Number(asset.purchasePrice),
        asset.acquisitionDate,
        duree,
      );
      if (!result.prixNonRenseigne) {
        totalVncCourante += result.vncCourante;
        totalDotationAnnuelle += result.dotationAnnuelle;
        if (result.estAmorti) countAmortis++;
      }
    }
    const vueFinanciere = {
      totalVncCourante: Math.round(totalVncCourante * 100) / 100,
      totalDotationAnnuelle: Math.round(totalDotationAnnuelle * 100) / 100,
      countAmortis,
    };

    // Activité 30 jours
    const newAssets = allAssets.filter(
      (a) => new Date(a.createdAt).getTime() >= thirtyDaysAgo.getTime(),
    ).length;
    const activite30j = {
      newAssets,
      newAttributions,
      newReturns,
      newDaTriggered: newPurchases,
    };

    // Par localisation
    const localisationMap = new Map<
      string,
      { count: number; totalPrix: number }
    >();
    for (const asset of allAssets) {
      const loc = asset.location ?? 'Non renseigné';
      const existing = localisationMap.get(loc);
      if (existing) {
        existing.count++;
        existing.totalPrix += Number(asset.purchasePrice);
      } else {
        localisationMap.set(loc, {
          count: 1,
          totalPrix: Number(asset.purchasePrice),
        });
      }
    }
    const parLocalisation = Array.from(localisationMap.entries()).map(
      ([location, { count, totalPrix }]) => ({ location, count, totalPrix }),
    );

    return {
      kpis: { totalAssets, totalStockDisponible, enRupture, valeurTotale },
      repartitionCategorie,
      repartitionEtat,
      stockCritique,
      demandesEnAttente,
      vueFinanciere,
      activite30j,
      parLocalisation,
    };
  }
}
