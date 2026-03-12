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
import { AddSupplierItemsDto } from '../dto/add-supplier-items.dto';
import { PurchaseStep, PurchaseStatus, Role } from '@prisma/client';
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

    if (purchase.status !== PurchaseStatus.PUBLISHED) {
      throw new BadRequestException(
        'Ce PV ne peut plus etre modifie car il est deja soumis pour validation',
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

    if (purchase.status !== PurchaseStatus.PUBLISHED) {
      throw new BadRequestException('Ce PV a deja ete soumis');
    }

    if (purchase.pv.suppliers.length === 0) {
      throw new BadRequestException(
        'Ajoutez au moins un fournisseur avant de soumettre le PV',
      );
    }

    await this.prisma.purchase.update({
      where: { id: purchaseId },
      data: { status: PurchaseStatus.PENDING_APPROVAL },
    });

    this.logger.info('PV soumis pour validation', {
      pvId: purchase.pv.id,
      purchaseId,
      userId,
    });

    return { ...purchase.pv, message: 'PV soumis pour validation' };
  }

  async getPV(purchaseId: string) {
    const pv = await this.pvRepository.findByPurchaseId(purchaseId);
    if (!pv) throw new NotFoundException('Aucun PV trouve pour cette DA');
    return pv;
  }

  async addSupplierItems(
    purchaseId: string,
    supplierId: string,
    userId: number,
    dto: AddSupplierItemsDto,
  ) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { pv: { include: { suppliers: true } } },
    });

    if (!purchase) throw new NotFoundException("Demande d'achat non trouvee");
    if (!purchase.pv)
      throw new NotFoundException('Aucun PV trouve pour cette DA');

    if (purchase.status !== PurchaseStatus.PUBLISHED) {
      throw new BadRequestException(
        'Ce PV ne peut plus etre modifie car il est deja soumis pour validation',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== Role.ACHETEUR) {
      throw new ForbiddenException(
        'Seul un acheteur peut ajouter des articles',
      );
    }

    const supplier = purchase.pv.suppliers.find((s) => s.id === supplierId);
    if (!supplier) {
      throw new NotFoundException('Fournisseur non trouve dans ce PV');
    }

    await this.prisma.pVSupplierItem.deleteMany({
      where: { supplierId: supplierId },
    });

    const items = await Promise.all(
      dto.items.map((item) =>
        this.prisma.pVSupplierItem.create({
          data: {
            supplierId: supplierId,
            purchaseItemId: item.purchaseItemId,
            designation: item.designation,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.quantity * item.unitPrice,
            disponibilite: item.disponibilite,
          },
        }),
      ),
    );

    this.logger.info('Articles ajoutés au fournisseur PV', {
      pvId: purchase.pv.id,
      supplierId,
      itemsCount: items.length,
      userId,
    });

    return {
      supplierId,
      items,
      message: 'Articles ajoutes au fournisseur avec succes',
    };
  }

  async selectSupplierItems(
    purchaseId: string,
    supplierId: string,
    userId: number,
    itemIds: string[],
  ) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        pv: {
          include: {
            suppliers: {
              include: { items: true },
            },
          },
        },
      },
    });

    if (!purchase) throw new NotFoundException("Demande d'achat non trouvee");
    if (!purchase.pv)
      throw new NotFoundException('Aucun PV trouve pour cette DA');

    if (purchase.status !== PurchaseStatus.PUBLISHED) {
      throw new BadRequestException(
        'Ce PV ne peut plus etre modifie car il est deja soumis pour validation',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== Role.ACHETEUR) {
      throw new ForbiddenException(
        'Seul un acheteur peut selectionner des articles',
      );
    }

    const supplier = purchase.pv.suppliers.find((s) => s.id === supplierId);
    if (!supplier) {
      throw new NotFoundException('Fournisseur non trouve dans ce PV');
    }

    const supplierItemIds = supplier.items.map((item) => item.id);
    const invalidIds = itemIds.filter((id) => !supplierItemIds.includes(id));
    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `Articles non trouves pour ce fournisseur: ${invalidIds.join(', ')}`,
      );
    }

    // Déselectionner tous les articles de ce fournisseur
    await this.prisma.pVSupplierItem.updateMany({
      where: { supplierId },
      data: { isSelected: false },
    });

    // Sélectionner les articles spécifiés
    await this.prisma.pVSupplierItem.updateMany({
      where: {
        id: { in: itemIds },
        supplierId,
      },
      data: { isSelected: true },
    });

    const updatedSupplier = await this.prisma.pVSupplier.findUnique({
      where: { id: supplierId },
      include: { items: true },
    });

    if (!updatedSupplier) {
      throw new NotFoundException('Fournisseur non trouve');
    }

    this.logger.info('Articles sélectionnés pour le fournisseur', {
      pvId: purchase.pv.id,
      supplierId,
      selectedCount: itemIds.length,
      userId,
    });

    return {
      supplierId,
      selectedItems: updatedSupplier.items.filter((item) => item.isSelected),
      message: 'Articles selectionnes avec succes',
    };
  }

  async getSelectedItems(purchaseId: string) {
    const pv = await this.pvRepository.findByPurchaseId(purchaseId);
    if (!pv) throw new NotFoundException('Aucun PV trouve pour cette DA');

    const suppliersWithItems = pv.suppliers.map((supplier) => {
      const allItems = supplier.items.map((item) => ({
        id: item.id,
        purchaseItemId: item.purchaseItemId,
        designation: item.designation,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
        disponibilite: item.disponibilite,
        isSelected: item.isSelected,
      }));

      const selectedItems = allItems.filter((item) => item.isSelected);
      const totalAmount = selectedItems.reduce(
        (sum, item) => sum + Number(item.amount),
        0,
      );

      return {
        supplierId: supplier.supplierId,
        pvSupplierId: supplier.id,
        supplierName: supplier.name || supplier.supplier?.name,
        supplierDetails: supplier.supplier
          ? {
              nif: supplier.supplier.nif,
              stat: supplier.supplier.stat,
              address: supplier.supplier.address,
              phone: supplier.supplier.phone,
              email: supplier.supplier.email,
              region: supplier.supplier.region,
            }
          : null,
        allItems,
        selectedItems,
        selectedCount: selectedItems.length,
        totalAmount,
      };
    });

    const totalSelected = suppliersWithItems.reduce(
      (sum, supplier) => sum + supplier.selectedCount,
      0,
    );

    const grandTotal = suppliersWithItems.reduce(
      (sum, supplier) => sum + supplier.totalAmount,
      0,
    );

    return {
      purchaseId,
      pvId: pv.id,
      evaluateur: pv.evaluateur,
      dateEvaluation: pv.dateEvaluation,
      decisionFinale: pv.decisionFinale,
      suppliers: suppliersWithItems,
      totalSelected,
      grandTotal,
      message: `${totalSelected} article(s) selectionne(s) sur ${suppliersWithItems.reduce((sum, s) => sum + s.allItems.length, 0)} article(s) au total`,
    };
  }
}
