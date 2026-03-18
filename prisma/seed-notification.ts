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
  console.log('🚀 Génération des données de test (Validation & Relance)...\n');

  try {
    // 1. Reset
    await prisma.notification.deleteMany();
    await prisma.validator.deleteMany();
    await prisma.validationWorkflow.deleteMany();
    await prisma.purchaseItem.deleteMany();
    await prisma.purchase.deleteMany();
    await prisma.user.deleteMany();

    // 2. Création des Utilisateurs (Mot de passe: password)
    const hashedPwd = await bcrypt.hash('password', 10);
    const usersMap: Record<string, number> = {};
    for (const role of Object.values(ValidatorRole)) {
      const user = await prisma.user.create({
        data: {
          email: `${role.toLowerCase()}@osdrm.mg`,
          name: `User ${role}`,
          password: hashedPwd,
          fonction: role,
          role: role as unknown as Role,
        },
      });
      usersMap[role] = user.id;
    }

    const now = new Date();
    const ilYa2Jours = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const dans1An = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    // 3. Helper Universel avec gestion de la progression
    const createFolder = async (params: {
      ref: string;
      step: PurchaseStep;
      amount: number;
      roles: ValidatorRole[];
      validatedUntilIndex?: number; // Index (0..N) jusqu'où c'est déjà validé
      relanceEmail?: string;
    }) => {
      const purchase = await prisma.purchase.create({
        data: {
          reference: params.ref,
          title: `Dossier ${params.ref}`,
          status: PurchaseStatus.PENDING_APPROVAL,
          currentStep: params.step,
          operationType:
            params.amount > 5000000
              ? OperationType.PROGRAMME
              : OperationType.OPERATION,
          justification: `Test de validation pour ${params.ref}`,
          creatorId: usersMap[ValidatorRole.DEMANDEUR],
          items: {
            create: [
              {
                designation: 'Matériel standard',
                quantity: 1,
                unitPrice: params.amount,
                amount: params.amount,
              },
            ],
          },
          validationWorkflows: {
            create: {
              step: params.step,
              validators: {
                create: params.roles.map((role, index) => ({
                  role,
                  order: index + 1,
                  email: `${role.toLowerCase()}@osdrm.mg`,
                  userId: usersMap[role],
                  // Si l'index est <= validatedUntilIndex, le validateur a déjà signé
                  isValidated:
                    params.validatedUntilIndex !== undefined &&
                    index <= params.validatedUntilIndex,
                })),
              },
            },
          },
        },
      });

      // Création de la notification de relance pour le validateur ACTUEL (le premier non validé)
      if (params.relanceEmail) {
        let eventType: string = OSDRM_PROCESS_EVENT.DA_CREATED;
        if (params.step === PurchaseStep.PV)
          eventType = OSDRM_PROCESS_EVENT.PV_UPLOADED;
        if (params.step === PurchaseStep.QR)
          eventType = OSDRM_PROCESS_EVENT.QR_UPLOADED;

        await prisma.notification.create({
          data: {
            type: eventType,
            resourceId: purchase.id,
            recipients: [params.relanceEmail],
            status: NotificationStatus.SENT,
            hasReminder: true,
            reminderIntervalInDays: 1,
            lastSentAt: ilYa2Jours, // Prêt pour le Cron
            expiredAt: dans1An,
            data: { reference: params.ref, step: params.step } as any,
          },
        });
      }
      return purchase;
    };

    // --- SCÉNARIOS DE VALIDATION ---

    console.log("📑 Dossiers DA (Demande d'Achat)...");
    // DA-001: Personne n'a validé. OM doit valider.
    await createFolder({
      ref: 'DA-001',
      step: PurchaseStep.DA,
      amount: 1000000,
      roles: [ValidatorRole.OM, ValidatorRole.RFR],
      relanceEmail: 'om@osdrm.mg',
    });

    // DA-002: OM a déjà validé. C'est au tour du CFO.
    await createFolder({
      ref: 'DA-002',
      step: PurchaseStep.DA,
      amount: 7000000,
      roles: [ValidatorRole.OM, ValidatorRole.CFO, ValidatorRole.CEO],
      validatedUntilIndex: 0,
      relanceEmail: 'cfo@osdrm.mg',
    });

    console.log('⚖️ Dossiers PV (Procès-Verbal)...');
    // PV-001: En attente CFO.
    await createFolder({
      ref: 'PV-001',
      step: PurchaseStep.PV,
      amount: 12000000,
      roles: [ValidatorRole.CFO, ValidatorRole.CEO],
      relanceEmail: 'cfo@osdrm.mg',
    });

    // PV-002: CFO a validé. En attente CEO.
    await createFolder({
      ref: 'PV-002',
      step: PurchaseStep.PV,
      amount: 15000000,
      roles: [ValidatorRole.CFO, ValidatorRole.CEO],
      validatedUntilIndex: 0,
      relanceEmail: 'ceo@osdrm.mg',
    });

    console.log('📦 Dossiers QR (Quittance)...');
    // QR-001: En attente OM.
    await createFolder({
      ref: 'QR-001',
      step: PurchaseStep.QR,
      amount: 500000,
      roles: [ValidatorRole.OM, ValidatorRole.RFR],
      relanceEmail: 'om@osdrm.mg',
    });

    console.log('\n✅ Seed terminé !');
    console.log('Utilise "password" pour tester les comptes suivants :');
    console.log('- om@osdrm.mg (DA-001, QR-001)');
    console.log('- cfo@osdrm.mg (DA-002, PV-001)');
    console.log('- ceo@osdrm.mg (PV-002)');
  } catch (error) {
    console.error('❌ Erreur :', error);
  } finally {
    await pool.end();
  }
}

seedNotificationData();
