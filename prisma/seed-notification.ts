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
  console.log('🌱 Starting OSDRM Full Seeding (Users + Notifications)...\n');

  try {
    const types = Object.values(OSDRM_PROCESS_EVENT);

    // 1. Création des utilisateurs (Recipients)
    const userData = [
      {
        email: 'demandeur1@osdrm.mg',
        name: 'Jean Demandeur',
        role: Role.DEMANDEUR,
      },
      { email: 'validateur@osdrm.mg', name: 'Marc Validateur', role: Role.RFR },
      { email: 'admin@osdrm.mg', name: 'Admin OSDRM', role: Role.ADMIN },
    ];

    console.log('👥 Syncing users...');
    for (const u of userData) {
      await prisma.user.upsert({
        where: { email: u.email },
        update: {},
        create: {
          email: u.email,
          name: u.name,
          role: u.role,
          password: 'hashed_password_here', // À adapter selon ton auth
          fonction: 'Staff OSDRM',
        },
      });
    }

    const emails = userData.map((u) => u.email);

    // 2. Nettoyage des anciennes notifications
    console.log('🗑️ Cleaning notifications table...');
    await prisma.notification.deleteMany();

    // 3. Génération des notifications
    console.log('🚀 Generating 30 notifications...');
    const notifications: Prisma.NotificationCreateManyInput[] = [];

    for (let i = 0; i < 30; i++) {
      const type = types[i % types.length];
      const status =
        type === OSDRM_PROCESS_EVENT.DA_CREATED
          ? NotificationStatus.PENDING
          : NotificationStatus.SENT;

      notifications.push({
        type: type,
        resourceId: `RES-LOG-${1000 + i}`,
        resourceType: type.includes('UPLOADED') ? 'DOCUMENT' : 'PURCHASE',
        recipients: [emails[i % emails.length]] as Prisma.JsonArray,
        data: {
          id: i,
          reference: `NOTIF-2026-${i}`,
          message: `Test d'évènement : ${type}`,
          link: `http://localhost:3000/resources/${i}`,
        } as Prisma.JsonObject,
        status: status,
        hasReminder: i % 5 === 0,
        attemptCount: status === NotificationStatus.SENT ? 1 : 0,
        reminderCount: 0,
        lastSentAt: status === NotificationStatus.SENT ? new Date() : null,
        expiredAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    }

    await prisma.notification.createMany({
      data: notifications,
    });

    console.log('\n✅ Seed terminé avec succès !');
    console.log(`📊 Utilisateurs synchronisés : ${emails.length}`);
    console.log(`📊 Notifications créées : 30`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : error;
    console.error('❌ Error during seeding:', msg);
    throw error;
  } finally {
    await pool.end();
  }
}

seedNotificationData().catch((error) => {
  console.error('Fatal error during seeding:', error);
  process.exit(1);
});
