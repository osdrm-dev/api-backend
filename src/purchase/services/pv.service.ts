import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PVRepository } from '../../repository/purchase/pv.repository';
import { CreatePVDto } from '../dto/create-pv.dto';
import { UpdatePVDto } from '../dto/update-pv.dto';
import { PurchaseStep, PurchaseStatus, PVStatus, Role } from '@prisma/client';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class PVService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pvRepository: PVRepository,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  private buildSupplierData(supplier: any) {
    return {
      order: supplier.order,
      name: supplier.name,
      rang: supplier.rang,
      ...(supplier.supplierId && {
        supplier: { connect: { id: supplier.supplierId } },
      }),
      reponseDansDelai: supplier.reponseDansDelai,
      annexe1: supplier.annexe1,
      devisSpecifications: supplier.devisSpecifications,
      regulariteFiscale: supplier.regulariteFiscale,
      copiecin: supplier.copiecin,
      conformiteSpecs: supplier.conformiteSpecs,
      distanceBureaux: supplier.distanceBureaux,
      delaiLivraison: supplier.delaiLivraison,
      sav: supplier.sav,
      disponibiliteArticles: supplier.disponibiliteArticles,
      qualiteArticles: supplier.qualiteArticles,
      experienceAnterieure: supplier.experienceAnterieure,
      producteurOuSousTraitant: supplier.producteurOuSousTraitant,
      echantillonBat: supplier.echantillonBat,
      validiteOffre: supplier.validiteOffre,
      modePaiement: supplier.modePaiement,
      delaiPaiement: supplier.delaiPaiement,
      offreFinanciere: supplier.offreFinanciere,
      items: supplier.items
        ? {
            create: supplier.items.map((item: any) => ({
              purchaseItemId: item.purchaseItemId,
              designation: item.designation,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: item.quantity * item.unitPrice,
              disponibilite: item.disponibilite,
            })),
          }
        : undefined,
    };
  }

  private async validateSuppliers(suppliers: any[]) {
    for (const supplier of suppliers) {
      if (supplier.supplierId) {
        const existing = await this.prisma.supplier.findUnique({
          where: { id: supplier.supplierId },
        });
        if (!existing) {
          throw new NotFoundException(
            `Fournisseur avec l'id ${supplier.supplierId} non trouve`,
          );
        }
        if (!existing.active) {
          throw new BadRequestException(
            `Le fournisseur ${existing.name} n'est pas actif`,
          );
        }
      }
    }
  }

  async createPV(purchaseId: string, userId: number, dto: CreatePVDto) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { pv: true },
    });

    if (!purchase) throw new NotFoundException("Demande d'achat non trouvee");

    if (purchase.currentStep !== PurchaseStep.PV) {
      throw new BadRequestException(`La DA n'est pas a l'etape PV`);
    }

    if (purchase.status !== PurchaseStatus.PUBLISHED) {
      throw new BadRequestException('La DA doit etre publiee');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== Role.ACHETEUR) {
      throw new ForbiddenException('Seul un acheteur peut creer un PV');
    }

    if (purchase.pv) {
      throw new BadRequestException(
        'Un PV existe deja pour cette DA. Utilisez la mise a jour.',
      );
    }

    await this.validateSuppliers(dto.suppliers);

    const pv = await this.pvRepository.create({
      purchase: { connect: { id: purchaseId } },
      evaluateur: dto.evaluateur,
      dateEvaluation: dto.dateEvaluation ? new Date(dto.dateEvaluation) : null,
      natureObjet: dto.natureObjet,
      decisionFinale: dto.decisionFinale,
      status: PVStatus.DRAFT,
      suppliers: {
        create: dto.suppliers.map((s) => this.buildSupplierData(s)),
      },
    });

    this.logger.info('PV créé', { pvId: pv.id, purchaseId, userId });

    return { ...pv, message: 'PV cree avec succes' };
  }

  async updatePV(purchaseId: string, userId: number, dto: UpdatePVDto) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { pv: true },
    });

    if (!purchase) throw new NotFoundException("Demande d'achat non trouvee");
    if (!purchase.pv)
      throw new NotFoundException('Aucun PV trouve pour cette DA');

    if (
      purchase.pv.status === PVStatus.SUBMITTED ||
      purchase.pv.status === PVStatus.VALIDATED
    ) {
      throw new BadRequestException(
        'Ce PV ne peut plus etre modifie car il est deja soumis ou valide',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== Role.ACHETEUR) {
      throw new ForbiddenException('Seul un acheteur peut modifier un PV');
    }

    if (dto.suppliers) {
      await this.validateSuppliers(dto.suppliers);
      await this.pvRepository.deleteSuppliersById(purchase.pv.id);
    }

    const pv = await this.pvRepository.update({
      where: { id: purchase.pv.id },
      data: {
        evaluateur: dto.evaluateur,
        dateEvaluation: dto.dateEvaluation
          ? new Date(dto.dateEvaluation)
          : undefined,
        natureObjet: dto.natureObjet,
        decisionFinale: dto.decisionFinale,
        suppliers: dto.suppliers
          ? { create: dto.suppliers.map((s) => this.buildSupplierData(s)) }
          : undefined,
      },
    });

    this.logger.info('PV mis à jour', { pvId: pv.id, purchaseId, userId });

    return { ...pv, message: 'PV mis a jour avec succes' };
  }

  async submitPV(purchaseId: string, userId: number) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { pv: { include: { suppliers: true } } },
    });

    if (!purchase) throw new NotFoundException("Demande d'achat non trouvee");
    if (!purchase.pv)
      throw new NotFoundException('Aucun PV trouve pour cette DA');

    if (purchase.pv.status !== PVStatus.DRAFT) {
      throw new BadRequestException('Ce PV a deja ete soumis');
    }

    if (purchase.pv.suppliers.length === 0) {
      throw new BadRequestException(
        'Ajoutez au moins un fournisseur avant de soumettre le PV',
      );
    }

    const pv = await this.pvRepository.updateStatus({
      id: purchase.pv.id,
      status: PVStatus.SUBMITTED,
    });

    this.logger.info('PV soumis pour validation', {
      pvId: pv.id,
      purchaseId,
      userId,
    });

    return { ...pv, message: 'PV soumis pour validation' };
  }

  async getPV(purchaseId: string) {
    const pv = await this.pvRepository.findByPurchaseId(purchaseId);
    if (!pv) throw new NotFoundException('Aucun PV trouve pour cette DA');
    return pv;
  }
}
