import 'dotenv/config';
import { PrismaClient, NotificationStatus, Prisma, Role } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { OSDRM_PROCESS_EVENT } from 'src/notification/constants/notification.constants';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL est manquant dans les variables d'environnement",
  );
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool, { schema: 'public' });
const prisma = new PrismaClient({ adapter });

async function seedNotificationData() {
  console.log('🌱 Starting OSDRM Test Scenarios Seeding (Days version)...\n');

  try {
    // 1. Utilisateurs
    const userData = [
      {
        email: 'demandeur@osdrm.mg',
        name: 'Jean Demandeur',
        role: Role.DEMANDEUR,
      },
      { email: 'validateur@osdrm.mg', name: 'Marc Validateur', role: Role.RFR },
    ];

    for (const u of userData) {
      await prisma.user.upsert({
        where: { email: u.email },
        update: {},
        create: { ...u, password: 'password', fonction: 'Staff' },
      });
    }

    // 2. Nettoyage
    await prisma.notification.deleteMany();

    const notifications: Prisma.NotificationCreateManyInput[] = [
      // --- SCÉNARIO 1 : Nouvelles notifications (Cycle 1 Minute) ---
      {
        type: OSDRM_PROCESS_EVENT.DA_CREATED,
        resourceId: 'DA-2026-001',
        recipients: ['validateur@osdrm.mg'],
        status: NotificationStatus.PENDING,
        hasReminder: true,
        reminderIntervalInDays: 1, // 1 jour
        attemptCount: 0,
        data: { reference: 'DA-001', author: 'Jean' } as any,
      },

      // --- SCÉNARIO 2 : Échecs techniques (Retry Cycle) ---
      {
        type: OSDRM_PROCESS_EVENT.BC_UPLOADED,
        resourceId: 'BC-102',
        recipients: ['demandeur@osdrm.mg'],
        status: NotificationStatus.PENDING,
        attemptCount: 3,
        data: { reference: 'BC-102' } as any,
      },

      // --- SCÉNARIO 3 : Relance Métier - Éligible (Envoyée il y a 1.2 jour) ---
      {
        type: OSDRM_PROCESS_EVENT.DA_CREATED,
        resourceId: 'DA-OLD-999',
        recipients: ['validateur@osdrm.mg'],
        status: NotificationStatus.SENT,
        hasReminder: true,
        reminderIntervalInDays: 1,
        reminderCount: 0,
        attemptCount: 1,
        // Simulation : il y a 28 heures (soit > 1 jour)
        lastSentAt: new Date(Date.now() - 28 * 60 * 60 * 1000),
        data: { reference: 'DA-OLD-999', author: 'Jean' } as any,
      },

      // --- SCÉNARIO 4 : Relance Métier - Non éligible (Envoyée il y a 12h pour un intervalle de 1j) ---
      {
        type: OSDRM_PROCESS_EVENT.DPA_CREATED,
        resourceId: 'DPA-RECENT',
        recipients: ['validateur@osdrm.mg'],
        status: NotificationStatus.SENT,
        hasReminder: true,
        reminderIntervalInDays: 1,
        reminderCount: 0,
        lastSentAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
        data: { reference: 'DPA-TOO-EARLY' } as any,
      },

      // --- SCÉNARIO 5 : Déjà relancé (Envoyé il y a 2.1 jours pour un intervalle de 1j) ---
      {
        type: OSDRM_PROCESS_EVENT.DPA_CREATED,
        resourceId: 'DPA-555',
        recipients: ['validateur@osdrm.mg'],
        status: NotificationStatus.SENT,
        hasReminder: true,
        reminderIntervalInDays: 1,
        reminderCount: 1,
        lastSentAt: new Date(Date.now() - 50 * 60 * 60 * 1000),
        data: { reference: 'DPA-555' } as any,
      },

      // --- SCÉNARIO 6 : Limite de rappel atteinte (3 rappels) ---
      {
        type: OSDRM_PROCESS_EVENT.DA_CREATED,
        resourceId: 'DA-IGNORED',
        recipients: ['validateur@osdrm.mg'],
        status: NotificationStatus.SENT,
        hasReminder: true,
        reminderIntervalInDays: 1,
        reminderCount: 3,
        lastSentAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        data: { reference: 'STOP' } as any,
      },
    ];

    // Ajout de volume (SENT aujourd'hui, pas de rappels)
    for (let i = 0; i < 10; i++) {
      notifications.push({
        type: OSDRM_PROCESS_EVENT.PV_UPLOADED,
        resourceId: `VOL-${i}`,
        recipients: ['demandeur@osdrm.mg'],
        status: NotificationStatus.SENT,
        lastSentAt: new Date(),
        hasReminder: false,
        data: { info: 'Volume test' } as any,
      });
    }

    await prisma.notification.createMany({ data: notifications });

    console.log(`✅ Seed terminé avec succès !`);
    console.log(`📊 Scénarios configurés pour reminderIntervalInDays.`);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
  } finally {
    await pool.end();
  }
}

seedNotificationData();
