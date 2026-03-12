// ... tes imports inchangés
import 'dotenv/config';
import { PrismaClient, NotificationStatus, Prisma } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { NOTIFICATION_TYPES } from 'src/notification/constants/notification.constants';

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
  console.log('🌱 Starting notification data seeding...\n');

  try {
    const types = Object.values(NOTIFICATION_TYPES);
    const emails = [
      'demandeur1@osdrm.mg',
      'validateur@osdrm.mg',
      'admin@osdrm.mg',
    ];

    console.log('🗑️ Cleaning notifications table...');
    await prisma.notification.deleteMany();

    console.log('🚀 Generating 30 notifications...');
    const notifications: Prisma.NotificationCreateManyInput[] = [];

    for (let i = 0; i < 30; i++) {
      const type = types[i % types.length];

      // LOGIQUE MODIFIÉE ICI :
      // On met PENDING uniquement si le type est DA_CREATE, sinon SENT
      const status =
        type === NOTIFICATION_TYPES.DA_CREATE
          ? NotificationStatus.PENDING
          : NotificationStatus.SENT;

      notifications.push({
        type: type,
        resourceId: `RES-LOG-${1000 + i}`,
        resourceType: type.startsWith('UPLOAD') ? 'DOCUMENT' : 'PURCHASE',
        recipients: [emails[i % emails.length]] as Prisma.JsonArray,
        data: {
          id: i,
          reference: `NOTIF-2026-${i}`,
          message: `Ceci est un test pour le type ${type}`,
          link: `http://localhost:3000/resources/${i}`,
        } as Prisma.JsonObject,
        status: status, // Utilisation du statut dynamique
        hasReminder: i % 5 === 0,
        attemptCount: status === NotificationStatus.SENT ? 1 : 0, // 1 tentative si déjà envoyé
        reminderCount: 0,
        lastSentAt: status === NotificationStatus.SENT ? new Date() : null, // Date si envoyé
        expiredAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    }

    await prisma.notification.createMany({
      data: notifications,
    });

    const pendingCount = notifications.filter(
      (n) => n.status === 'PENDING',
    ).length;
    const sentCount = notifications.filter((n) => n.status === 'SENT').length;

    console.log('\n✅ Seed terminé !');
    console.log(`📊 Résumé :`);
    console.log(`   - PENDING (DA_CREATE) : ${pendingCount}`);
    console.log(`   - SENT (Autres types) : ${sentCount}`);
  } catch (error) {
    console.error('❌ Error seeding notifications:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

seedNotificationData().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
