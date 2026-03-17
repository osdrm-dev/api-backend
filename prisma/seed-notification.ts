import 'dotenv/config';
import {
  PrismaClient,
  NotificationStatus,
  PurchaseStatus,
  PurchaseStep,
  Role,
  OperationType,
  ValidatorRole,
} from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool, { schema: 'public' });
const prisma = new PrismaClient({ adapter });

async function seedNotificationData() {
  console.log('🌱 Seed Complet : DA, PV, QR avec Relance et Audit...\n');

  try {
    // 1. Nettoyage
    await prisma.notification.deleteMany();
    await prisma.validator.deleteMany();
    await prisma.validationWorkflow.deleteMany();
    await prisma.purchaseItem.deleteMany();
    await prisma.purchase.deleteMany();
    await prisma.user.deleteMany();

    // 2. Utilisateurs
    const hashedDefaultPassword = await bcrypt.hash('password', 10);
    const usersMap: Record<string, number> = {};

    for (const role of Object.values(ValidatorRole)) {
      const user = await prisma.user.create({
        data: {
          email: `${role.toLowerCase()}@osdrm.mg`,
          name: `User ${role}`,
          password: hashedDefaultPassword,
          fonction: role,
          role: role as unknown as Role,
        },
      });
      usersMap[role] = user.id;
    }

    const now = new Date();
    const dateIlYa48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const dateExpirationLoin = new Date(
      now.getTime() + 365 * 24 * 60 * 60 * 1000,
    );

    // 3. Helper Universel pour toutes les étapes
    const createPurchaseFullCycle = async (
      ref: string,
      step: PurchaseStep,
      amount: number,
      roles: ValidatorRole[],
      relanceEmail?: string,
    ) => {
      const purchase = await prisma.purchase.create({
        data: {
          reference: ref,
          title: `Dossier ${ref} (${step})`,
          status: PurchaseStatus.PENDING_APPROVAL,
          currentStep: step,
          operationType: OperationType.OPERATION,
          justification: `Test pour l'étape ${step}`,
          creatorId: usersMap[ValidatorRole.DEMANDEUR],
          items: {
            create: [
              {
                designation: 'Item Test',
                quantity: 1,
                unitPrice: amount,
                amount: amount,
              },
            ],
          },
          validationWorkflows: {
            create: {
              step: step,
              validators: {
                create: roles.map((role, index) => ({
                  role,
                  order: index + 1,
                  email: `${role.toLowerCase()}@osdrm.mg`,
                  userId: usersMap[role],
                  isValidated: false,
                })),
              },
            },
          },
        },
      });

      if (relanceEmail) {
        // 1. Typer explicitement la variable pour accepter toutes les clés de l'enum
        let eventType: string = OSDRM_PROCESS_EVENT.DA_CREATED;

        // 2. Assigner les bonnes valeurs selon le step
        if (step === PurchaseStep.PV) {
          eventType = OSDRM_PROCESS_EVENT.PV_UPLOADED;
        } else if (step === PurchaseStep.QR) {
          eventType = OSDRM_PROCESS_EVENT.QR_UPLOADED;
        }

        await prisma.notification.create({
          data: {
            type: eventType,
            resourceId: purchase.id,
            recipients: [relanceEmail],
            status: NotificationStatus.SENT,
            hasReminder: true,
            reminderIntervalInDays: 1,
            lastSentAt: dateIlYa48h,
            expiredAt: dateExpirationLoin,
            data: { reference: ref, step: step } as any,
          },
        });
      }
      return purchase;
    };

    // --- SCÉNARIOS ---

    // Étape DA : Relance pour le RFR
    console.log('📑 Création étape DA (Relance RFR)...');
    await createPurchaseFullCycle(
      'DA-2026-001',
      PurchaseStep.DA,
      2500000,
      [ValidatorRole.DEMANDEUR, ValidatorRole.OM, ValidatorRole.RFR],
      'rfr@osdrm.mg',
    );

    // Étape PV : Relance pour le CFO
    console.log('⚖️ Création étape PV (Relance CFO)...');
    await createPurchaseFullCycle(
      'PV-2026-005',
      PurchaseStep.PV,
      12000000,
      [ValidatorRole.DEMANDEUR, ValidatorRole.CFO, ValidatorRole.CEO],
      'cfo@osdrm.mg',
    );

    // Étape QR : Relance pour le Logistique (ou OM selon ton flux)
    console.log('📦 Création étape QR (Relance OM)...');
    await createPurchaseFullCycle(
      'QR-2026-010',
      PurchaseStep.QR,
      500000,
      [ValidatorRole.DEMANDEUR, ValidatorRole.OM],
      'om@osdrm.mg',
    );

    // Étape PV : Nouveau dossier en attente (Sans relance immédiate)
    console.log('🆕 Création PV en attente simple...');
    const pvNew = await createPurchaseFullCycle(
      'PV-2026-NEW',
      PurchaseStep.PV,
      3000000,
      [ValidatorRole.DEMANDEUR, ValidatorRole.OM, ValidatorRole.RFR],
    );
    await prisma.notification.create({
      data: {
        type: OSDRM_PROCESS_EVENT.PV_UPLOADED,
        resourceId: pvNew.id,
        recipients: ['om@osdrm.mg'],
        status: NotificationStatus.PENDING,
        hasReminder: true,
        reminderIntervalInDays: 1,
        expiredAt: dateExpirationLoin,
        data: { reference: 'PV-2026-NEW' } as any,
      },
    });

    console.log('\n🚀 Seed enrichi terminé !');
    console.log('Dossiers créés pour : DA (1), PV (2), QR (1)');
  } catch (error) {
    console.error('❌ Erreur :', error);
  } finally {
    await pool.end();
  }
}

seedNotificationData();
