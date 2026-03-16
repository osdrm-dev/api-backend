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
  console.log('🌱 Starting OSDRM Production-Like Test (Integer Days)...\n');

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

    // On utilise 1 jour (Entier) pour correspondre à ton schéma DB
    const ONE_DAY = 1;

    const notifications: Prisma.NotificationCreateManyInput[] = [
      // --- CYCLE 1 : NOUVELLES NOTIFICATIONS (PENDING) ---
      {
        type: OSDRM_PROCESS_EVENT.DA_CREATED,
        resourceId: 'DA-NEW-100',
        recipients: ['validateur@osdrm.mg'],
        status: NotificationStatus.PENDING,
        hasReminder: true,
        reminderIntervalInDays: ONE_DAY,
        data: { reference: 'NOUVELLE-DA-TEST' } as any,
        expiredAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },

      // --- CYCLE 2 : RELANCES ÉLIGIBLES (Simulées il y a 25 heures) ---
      // Comme l'intervalle est de 1 jour, elles seront détectées par processReminders()
      {
        type: OSDRM_PROCESS_EVENT.DA_CREATED,
        resourceId: 'DA-REMIND-001',
        recipients: ['validateur@osdrm.mg'],
        status: NotificationStatus.SENT,
        hasReminder: true,
        reminderIntervalInDays: ONE_DAY,
        reminderCount: 0,
        // Simulation : envoyée il y a 25h (donc > 1 jour)
        lastSentAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        data: { reference: 'RELANCE-DA-1' } as any,
      },
      {
        type: OSDRM_PROCESS_EVENT.DPA_CREATED,
        resourceId: 'DPA-REMIND-002',
        recipients: ['validateur@osdrm.mg'],
        status: NotificationStatus.SENT,
        hasReminder: true,
        reminderIntervalInDays: ONE_DAY,
        reminderCount: 1, // On simule qu'une relance a déjà été faite
        lastSentAt: new Date(Date.now() - 26 * 60 * 60 * 1000), // Il y a 26h
        expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        data: { reference: 'RELANCE-DPA-2' } as any,
      },

      // --- SCÉNARIO "TROP TÔT" (Envoyée il y a 2 heures) ---
      // L'intervalle est de 1 jour, donc 2h < 24h : Elle ne doit pas bouger.
      {
        type: OSDRM_PROCESS_EVENT.PV_UPLOADED,
        resourceId: 'PV-WAIT-003',
        recipients: ['demandeur@osdrm.mg'],
        status: NotificationStatus.SENT,
        hasReminder: true,
        reminderIntervalInDays: ONE_DAY,
        lastSentAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
        expiredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        data: { reference: 'TROP-TOT' } as any,
      },
    ];

    await prisma.notification.createMany({ data: notifications });

    console.log(`✅ Seed terminé avec succès !`);
    console.log(`📊 Précisions sur l'exécution :`);
    console.log(
      `   - DA-NEW-100 sera envoyée par processAllPending (Statut PENDING).`,
    );
    console.log(
      `   - DA-REMIND-001 et DPA-REMIND-002 seront envoyées par processReminders.`,
    );
    console.log(`     (Car leur lastSentAt date d'il y a plus de 24h).`);
    console.log(
      `   - PV-WAIT-003 restera en base sans rien faire (envoyée il y a seulement 2h).`,
    );
  } catch (error) {
    console.error('❌ Error during seeding:', error);
  } finally {
    await pool.end();
  }
}

seedNotificationData();
