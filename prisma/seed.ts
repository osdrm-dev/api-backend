import 'dotenv/config';

import {
  Role,
  OperationType,
  PurchaseStatus,
  PurchaseStep,
  AttachmentType,
  ValidatorRole,
  PVStatus,
  DerogationStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL est manquant dans les variables d'environnement",
  );
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool, { schema: 'public' });
const prisma = new PrismaClient({ adapter });

function loadJson<T>(filename: string): T {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, 'data', filename), 'utf-8'),
  );
}

function daApprovedValidators(
  users: {
    demandeur: { id: number; name: string; email: string };
    om?: { id: number; name: string; email: string };
    dp?: { id: number; name: string; email: string };
    cfo: { id: number; name: string; email: string };
    ceo: { id: number; name: string; email: string };
  },
  baseDate: Date,
) {
  const validators: any[] = [];
  let order = 0;
  const d = (offsetDays: number) =>
    new Date(baseDate.getTime() + offsetDays * 86400000);

  validators.push({
    role: ValidatorRole.DEMANDEUR,
    order: order++,
    userId: users.demandeur.id,
    name: users.demandeur.name,
    email: users.demandeur.email,
    isValidated: true,
    validatedAt: d(0),
    decision: 'APPROVED',
    comment: 'Publication de la demande',
  });
  if (users.om)
    validators.push({
      role: ValidatorRole.OM,
      order: order++,
      userId: users.om.id,
      name: users.om.name,
      email: users.om.email,
      isValidated: true,
      validatedAt: d(1),
      decision: 'APPROVED',
      comment: 'Valide OM',
    });
  if (users.dp)
    validators.push({
      role: ValidatorRole.DP,
      order: order++,
      userId: users.dp.id,
      name: users.dp.name,
      email: users.dp.email,
      isValidated: true,
      validatedAt: d(2),
      decision: 'APPROVED',
      comment: 'Alignement programme OK',
    });
  validators.push({
    role: ValidatorRole.CFO,
    order: order++,
    userId: users.cfo.id,
    name: users.cfo.name,
    email: users.cfo.email,
    isValidated: true,
    validatedAt: d(3),
    decision: 'APPROVED',
    comment: 'Budget disponible et valide',
  });
  validators.push({
    role: ValidatorRole.CEO,
    order: order++,
    userId: users.ceo.id,
    name: users.ceo.name,
    email: users.ceo.email,
    isValidated: true,
    validatedAt: d(4),
    decision: 'APPROVED',
    comment: 'Approbation finale',
  });
  return validators;
}

async function cleanup() {
  await prisma.auditLog.deleteMany();
  await prisma.pVSupplierItem.deleteMany();
  await prisma.pVSupplier.deleteMany();
  await prisma.pV.deleteMany();
  await prisma.validator.deleteMany();
  await prisma.validationWorkflow.deleteMany();
  await prisma.derogation.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.purchaseItem.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.file.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await cleanup();

  const pwd = await bcrypt.hash('Password123!', 10);

  const { users: usersData, suppliers: suppliersData } = loadJson<any>(
    'users-suppliers.json',
  );

  const userMap: Record<string, any> = {};
  for (const u of usersData) {
    const created = await prisma.user.create({
      data: {
        email: u.email,
        password: pwd,
        name: u.name,
        fonction: u.fonction,
        role: u.role as Role,
      },
    });
    userMap[u.key] = created;
  }

  const supplierMap: Record<string, any> = {};
  for (const s of suppliersData) {
    const created = await prisma.supplier.create({
      data: {
        name: s.name,
        status: s.status,
        nif: s.nif,
        stat: s.stat,
        rcs: s.rcs,
        region: s.region,
        address: s.address,
        phone: s.phone,
        email: s.email,
        label: s.label,
      },
    });
    supplierMap[s.key] = created;
  }

  const purchasesData = loadJson<any[]>('purchases.json');
  const purchaseMap: Record<string, any> = {};

  for (const pd of purchasesData) {
    const purchase = await prisma.purchase.create({
      data: {
        reference: pd.reference,
        year: pd.year,
        site: pd.site,
        sequentialNumber: pd.sequentialNumber,
        project: pd.project,
        region: pd.region,
        projectCode: pd.projectCode,
        grantCode: pd.grantCode,
        activityCode: pd.activityCode,
        costCenter: pd.costCenter,
        title: pd.title,
        description: pd.description,
        marketType: pd.marketType,
        operationType: pd.operationType as OperationType,
        requestedDeliveryDate: new Date(pd.requestedDeliveryDate),
        priority: pd.priority,
        justification: pd.justification,
        deliveryAddress: pd.deliveryAddress,
        status: pd.status as PurchaseStatus,
        currentStep: pd.currentStep as PurchaseStep,
        ...(pd.observations && { observations: pd.observations }),
        ...(pd.closedAt && { closedAt: new Date(pd.closedAt) }),
        ...(pd.validatedAt && { validatedAt: new Date(pd.validatedAt) }),
        ...(pd.receivedAt && { receivedAt: new Date(pd.receivedAt) }),
        creatorId: userMap[pd.creatorKey].id,
        items: {
          create: pd.items.map((item: any) => ({
            designation: item.designation,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
            ...(item.unit && { unit: item.unit }),
            ...(item.specifications && { specifications: item.specifications }),
          })),
        },
      },
    });
    purchaseMap[pd.reference] = purchase;

    if (pd.daWorkflow) {
      await prisma.validationWorkflow.create({
        data: {
          purchaseId: purchase.id,
          step: PurchaseStep.DA,
          currentStep: pd.daWorkflow.currentStep,
          isComplete: pd.daWorkflow.isComplete,
          validators: {
            create: pd.daWorkflow.validators.map((v: any) => ({
              role: v.role as ValidatorRole,
              order: v.order,
              userId: userMap[v.userKey].id,
              name: userMap[v.userKey].name,
              email: userMap[v.userKey].email,
              isValidated: v.isValidated,
              ...(v.validatedAt && { validatedAt: new Date(v.validatedAt) }),
              ...(v.decision && { decision: v.decision }),
              ...(v.comment && { comment: v.comment }),
            })),
          },
        },
      });
    }

    if (!pd.daWorkflow && pd.daWorkflowApproved) {
      const a = pd.daWorkflowApproved;
      await prisma.validationWorkflow.create({
        data: {
          purchaseId: purchase.id,
          step: PurchaseStep.DA,
          currentStep: 4,
          isComplete: true,
          validators: {
            create: daApprovedValidators(
              {
                demandeur: userMap[a.demandeurKey],
                ...(a.omKey && { om: userMap[a.omKey] }),
                ...(a.dpKey && { dp: userMap[a.dpKey] }),
                cfo: userMap[a.cfoKey],
                ceo: userMap[a.ceoKey],
              },
              new Date(a.baseDate),
            ),
          },
        },
      });
    }

    if (pd.qrWorkflow) {
      await prisma.validationWorkflow.create({
        data: {
          purchaseId: purchase.id,
          step: PurchaseStep.QR,
          currentStep: pd.qrWorkflow.currentStep,
          isComplete: pd.qrWorkflow.isComplete,
          validators: {
            create: pd.qrWorkflow.validators.map((v: any) => ({
              role: v.role as ValidatorRole,
              order: v.order,
              userId: userMap[v.userKey].id,
              name: userMap[v.userKey].name,
              email: userMap[v.userKey].email,
              isValidated: v.isValidated,
              ...(v.validatedAt && { validatedAt: new Date(v.validatedAt) }),
              ...(v.decision && { decision: v.decision }),
              ...(v.comment && { comment: v.comment }),
            })),
          },
        },
      });
    }

    if (!pd.qrWorkflow && pd.qrWorkflowApproved) {
      await prisma.validationWorkflow.create({
        data: {
          purchaseId: purchase.id,
          step: PurchaseStep.QR,
          currentStep: 2,
          isComplete: true,
          validators: {
            create: [
              {
                role: ValidatorRole.DEMANDEUR,
                order: 0,
                userId: userMap['acheteur'].id,
                name: userMap['acheteur'].name,
                email: userMap['acheteur'].email,
                isValidated: true,
                validatedAt: new Date(),
                decision: 'APPROVED',
                comment: '3 devis conformes uploades',
              },
              {
                role: ValidatorRole.CFO,
                order: 1,
                userId: userMap['cfo'].id,
                name: userMap['cfo'].name,
                email: userMap['cfo'].email,
                isValidated: true,
                validatedAt: new Date(),
                decision: 'APPROVED',
                comment: 'Validation QR accordee',
              },
            ],
          },
        },
      });
    }

    if (pd.attachments?.length) {
      await prisma.attachment.createMany({
        data: pd.attachments.map((a: any) => ({
          purchaseId: purchase.id,
          type: a.type as AttachmentType,
          fileName: a.fileName,
          fileUrl: a.fileUrl,
          fileSize: a.fileSize,
          mimeType: 'application/pdf',
          uploadedBy: userMap[a.uploadedByKey].name,
          ...(a.description && { description: a.description }),
          ...(a.receivedAt && { receivedAt: new Date(a.receivedAt) }),
        })),
      });
    }

    if (pd.derogation) {
      await prisma.derogation.create({
        data: {
          purchaseId: purchase.id,
          reason: pd.derogation.reason,
          justification: pd.derogation.justification,
          status: pd.derogation.status as DerogationStatus,
        },
      });
    }

    if (pd.pv) {
      const pv = pd.pv;
      await prisma.pV.create({
        data: {
          purchaseId: purchase.id,
          evaluateur: userMap[pv.evaluateurKey].name,
          dateEvaluation: new Date(pv.dateEvaluation),
          natureObjet: pv.natureObjet,
          decisionFinale: pv.decisionFinale,
          status: pv.status as PVStatus,
          suppliers: {
            create: pv.suppliers.map((s: any) => ({
              ...(s.supplierKey && {
                supplierId: supplierMap[s.supplierKey].id,
              }),
              ...(s.name && { name: s.name }),
              ...(!s.name &&
                s.supplierKey && { name: supplierMap[s.supplierKey].name }),
              order: s.order,
              rang: s.rang,
              reponseDansDelai: s.reponseDansDelai,
              annexe1: s.annexe1,
              devisSpecifications: s.devisSpecifications,
              regulariteFiscale: s.regulariteFiscale,
              copiecin: s.copiecin,
              conformiteSpecs: s.conformiteSpecs,
              distanceBureaux: s.distanceBureaux,
              delaiLivraison: s.delaiLivraison,
              sav: s.sav,
              disponibiliteArticles: s.disponibiliteArticles,
              qualiteArticles: s.qualiteArticles,
              experienceAnterieure: s.experienceAnterieure,
              producteurOuSousTraitant: s.producteurOuSousTraitant,
              echantillonBat: s.echantillonBat,
              validiteOffre: s.validiteOffre,
              modePaiement: s.modePaiement,
              delaiPaiement: s.delaiPaiement,
              offreFinanciere: s.offreFinanciere,
              items: {
                create: s.items.map((i: any) => ({
                  designation: i.designation,
                  quantity: i.quantity,
                  unitPrice: i.unitPrice,
                  amount: i.amount,
                  disponibilite: i.disponibilite,
                })),
              },
            })),
          },
        },
      });
    }
  }

  const auditLogsData = loadJson<any[]>('audit-logs.json');
  await prisma.auditLog.createMany({
    data: auditLogsData.map((log) => ({
      userId: userMap[log.userKey].id,
      action: log.action,
      resource: log.resource,
      resourceId: purchaseMap[log.purchaseRef].id,
      details: log.details,
    })),
  });

  console.log('Seeding termine: 8 users | 4 fournisseurs | 19 dossiers achat');
}

main()
  .catch((e) => {
    console.error('Erreur seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
