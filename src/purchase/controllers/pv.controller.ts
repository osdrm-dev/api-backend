import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { PVService } from '../services/pv.service';
import { CreatePVDto } from '../dto/create-pv.dto';
import { UpdatePVDto } from '../dto/update-pv.dto';
import { AddSupplierItemsDto } from '../dto/add-supplier-items.dto';
import { SelectSupplierItemsDto } from '../dto/select-supplier-items.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  ApiSuccessResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiCommonResponses,
} from '../../common/decorators/swagger.decorators';

@ApiTags('PV Management')
@ApiBearerAuth('JWT-auth')
@Controller('purchases/:purchaseId/pv')
@UseGuards(JwtAuthGuard)
export class PVController {
  constructor(private readonly pvService: PVService) {}

  @Post()
  @ApiOperation({
    summary: 'Creer un PV (Proces-Verbal)',
    description: `
      Cree un proces-verbal de comparaison des offres.
      Seul un ACHETEUR peut creer un PV.
      La DA doit etre a l'etape PV.
    `,
  })
  @ApiParam({ name: 'purchaseId', description: 'ID de la DA' })
  @ApiBody({
    type: CreatePVDto,
    examples: {
      'PV avec 2 fournisseurs': {
        value: {
          evaluateur: 'Jean Dupont',
          dateEvaluation: '2024-02-15',
          natureObjet: 'Achat de materiel informatique',
          decisionFinale: 'Fournisseur 1 retenu pour meilleure offre',
          suppliers: [
            {
              order: 1,
              supplierId: 'supplier-123',
              name: 'Fournisseur A',
              rang: 1,
              reponseDansDelai: 'Oui',
              conformiteSpecs: 'Conforme',
              offreFinanciere: 5000000,
              items: [
                {
                  purchaseItemId: 'item-1',
                  designation: 'Ordinateur portable',
                  quantity: 5,
                  unitPrice: 1000000,
                  amount: 5000000,
                  disponibilite: 'En stock',
                },
              ],
            },
            {
              order: 2,
              name: 'Fournisseur B',
              rang: 2,
              reponseDansDelai: 'Oui',
              conformiteSpecs: 'Conforme',
              offreFinanciere: 5500000,
              items: [
                {
                  designation: 'Ordinateur portable',
                  quantity: 5,
                  unitPrice: 1100000,
                  amount: 5500000,
                  disponibilite: 'Sur commande',
                },
              ],
            },
          ],
        },
      },
    },
  })
  @ApiCreatedResponse('PV cree avec succes', {
    id: 'pv-123',
    evaluateur: 'Jean Dupont',
    message: 'PV cree avec succes',
  })
  @ApiNotFoundResponse('DA')
  @ApiBadRequestResponse("DA pas a l'etape PV ou PV deja existant")
  @ApiCommonResponses()
  createPV(
    @Param('purchaseId') purchaseId: string,
    @Request() req,
    @Body() dto: CreatePVDto,
  ) {
    return this.pvService.createPV(purchaseId, req.user.id, dto);
  }

  @Patch()
  @ApiOperation({
    summary: 'Mettre a jour un PV',
    description:
      'Modifie un PV existant. Seul un ACHETEUR peut modifier un PV.',
  })
  @ApiParam({ name: 'purchaseId', description: 'ID de la DA' })
  @ApiBody({ type: UpdatePVDto })
  @ApiSuccessResponse('PV mis a jour', {
    id: 'pv-123',
    message: 'PV mis a jour avec succes',
  })
  @ApiNotFoundResponse('DA ou PV')
  @ApiBadRequestResponse('PV deja soumis pour validation')
  @ApiCommonResponses()
  updatePV(
    @Param('purchaseId') purchaseId: string,
    @Request() req,
    @Body() dto: UpdatePVDto,
  ) {
    return this.pvService.updatePV(purchaseId, req.user.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Recuperer un PV',
    description: "Recupere le PV d'une DA avec tous les fournisseurs et items",
  })
  @ApiParam({ name: 'purchaseId', description: 'ID de la DA' })
  @ApiSuccessResponse('PV recupere', {
    id: 'pv-123',
    evaluateur: 'Jean Dupont',
    suppliers: [],
  })
  @ApiNotFoundResponse('PV')
  @ApiCommonResponses()
  getPV(@Param('purchaseId') purchaseId: string) {
    return this.pvService.getPV(purchaseId);
  }

  @Post('suppliers/:supplierId/items')
  @ApiOperation({
    summary: 'Ajouter des articles a un fournisseur du PV',
    description:
      "Ajoute ou remplace les articles d'un fournisseur specifique dans le PV",
  })
  @ApiParam({ name: 'purchaseId', description: 'ID de la DA' })
  @ApiParam({ name: 'supplierId', description: 'ID du fournisseur dans le PV' })
  @ApiBody({
    type: AddSupplierItemsDto,
    examples: {
      'Articles fournisseur': {
        value: {
          items: [
            {
              purchaseItemId: 'item-1',
              designation: 'Ordinateur portable Dell',
              quantity: 5,
              unitPrice: 1000000,
              disponibilite: 'En stock',
            },
            {
              designation: 'Souris sans fil',
              quantity: 10,
              unitPrice: 50000,
              disponibilite: 'En stock',
            },
          ],
        },
      },
    },
  })
  @ApiSuccessResponse('Articles ajoutes', {
    supplierId: 'supplier-123',
    items: [],
    message: 'Articles ajoutes au fournisseur avec succes',
  })
  @ApiNotFoundResponse('DA, PV ou fournisseur')
  @ApiBadRequestResponse('PV deja soumis pour validation')
  @ApiCommonResponses()
  addSupplierItems(
    @Param('purchaseId') purchaseId: string,
    @Param('supplierId') supplierId: string,
    @Request() req,
    @Body() dto: AddSupplierItemsDto,
  ) {
    return this.pvService.addSupplierItems(
      purchaseId,
      supplierId,
      req.user.id,
      dto,
    );
  }

  @Post('suppliers/:supplierId/select-items')
  @ApiOperation({
    summary: "Selectionner les articles retenus d'un fournisseur",
    description: `
      Marque les articles d'un fournisseur comme selectionnes (retenus).
      Permet de faire la decision finale article par article.
      Seul un ACHETEUR peut selectionner des articles.
    `,
  })
  @ApiParam({ name: 'purchaseId', description: 'ID de la DA' })
  @ApiParam({ name: 'supplierId', description: 'ID du fournisseur dans le PV' })
  @ApiBody({
    type: SelectSupplierItemsDto,
    examples: {
      "Selection d'articles": {
        value: {
          itemIds: ['item-123', 'item-456'],
        },
      },
    },
  })
  @ApiSuccessResponse('Articles selectionnes', {
    supplierId: 'supplier-123',
    selectedItems: [],
    message: 'Articles selectionnes avec succes',
  })
  @ApiNotFoundResponse('DA, PV ou fournisseur')
  @ApiBadRequestResponse('PV deja soumis ou articles invalides')
  @ApiCommonResponses()
  selectSupplierItems(
    @Param('purchaseId') purchaseId: string,
    @Param('supplierId') supplierId: string,
    @Request() req,
    @Body() dto: SelectSupplierItemsDto,
  ) {
    return this.pvService.selectSupplierItems(
      purchaseId,
      supplierId,
      req.user.id,
      dto.itemIds,
    );
  }

  @Get('selected-items')
  @ApiOperation({
    summary: 'Recuperer le recapitulatif des articles selectionnes',
    description: `
      Retourne uniquement les fournisseurs et articles selectionnes (isSelected: true).
      Utile pour afficher un recap avant l'upload du BC.
      Inclut les totaux par fournisseur et le total general.
    `,
  })
  @ApiParam({ name: 'purchaseId', description: 'ID de la DA' })
  @ApiSuccessResponse('Recapitulatif des selections', {
    purchaseId: 'purchase-123',
    pvId: 'pv-456',
    selectedSuppliers: [],
    grandTotal: 5300000,
  })
  @ApiNotFoundResponse('PV')
  @ApiCommonResponses()
  getSelectedItems(@Param('purchaseId') purchaseId: string) {
    return this.pvService.getSelectedItems(purchaseId);
  }
}
