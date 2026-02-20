import 'dotenv/config';
import {
  Role,
  OperationType,
  PurchaseStatus,
  PurchaseStep,
  Purchase,
  User,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'crypto';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL est manquant dans les variables d'environnement",
  );
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool, { schema: 'public' });
const prisma = new PrismaClient({ adapter });

async function seedStatisticsData() {
  console.log('🌱 Starting statistics data seeding...\n');

  try {
    await prisma.purchase.deleteMany({});
    console.log('🗑️ All purchases deleted');
    const hashedPassword = await bcrypt.hash('Password123!', 10);

    const usersData = [
      {
        email: 'demandeur1@osdrm.mg',
        name: 'Alice Demandeur',
        fonction: 'Chef de Projet',
        role: Role.DEMANDEUR,
      },
      {
        email: 'demandeur2@osdrm.mg',
        name: 'Bob Demandeur',
        fonction: 'Responsable Achats',
        role: Role.DEMANDEUR,
      },
      {
        email: 'validateur@osdrm.mg',
        name: 'Charlie Validateur',
        fonction: 'Directeur',
        role: Role.CEO,
      },
      {
        email: 'admin@osdrm.mg',
        name: 'Diana Admin',
        fonction: 'Administrateur Système',
        role: Role.ADMIN,
      },
      {
        email: 'approbateur@osdrm.mg',
        name: 'Eve Approbateur',
        fonction: 'Comptable',
        role: Role.DP,
      },
    ];

    const users: User[] = [];
    for (const userData of usersData) {
      let user = await prisma.user.findUnique({
        where: { email: userData.email },
      });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: userData.email,
            password: hashedPassword,
            name: userData.name,
            fonction: userData.fonction,
            role: userData.role,
            isActive: true,
          },
        });
        console.log(`✅ Created user: ${userData.name}`);
      }
      users.push(user);
    }

    const allStatuses = [
      PurchaseStatus.DRAFT,
      PurchaseStatus.PUBLISHED,
      PurchaseStatus.VALIDATED,
      PurchaseStatus.REJECTED,
      PurchaseStatus.IN_DEROGATION,
    ];

    const regions = [
      'Analamanga',
      'Atsinanana',
      'Vakinankaratra',
      'Diana',
      'Sava',
    ];
    const marketTypes = [
      'Consultation',
      "Appel d'offres",
      'Direct',
      'Concours',
    ];
    const priorities = ['MOYENNE', 'URGENT', 'TRES_URGENT'];
    const steps = [
      PurchaseStep.DA,
      PurchaseStep.QR,
      PurchaseStep.DAP,
      PurchaseStep.BC,
    ];

    const allPurchases: Purchase[] = [];

    for (const user of users) {
      console.log(`\n📦 Creating purchases for ${user.name}...`);
      const userPurchases: Purchase[] = [];

      const purchaseCount = Math.floor(Math.random() * 6) + 5;

      for (let i = 1; i <= purchaseCount; i++) {
        const status =
          allStatuses[Math.floor(Math.random() * allStatuses.length)];
        const region = regions[Math.floor(Math.random() * regions.length)];
        const marketType =
          marketTypes[Math.floor(Math.random() * marketTypes.length)];
        const priority =
          priorities[Math.floor(Math.random() * priorities.length)];
        const step = steps[Math.floor(Math.random() * steps.length)];
        const totalAmount = Math.floor(Math.random() * 10000) + 1000;
        const operationType =
          Math.random() > 0.5
            ? OperationType.PROGRAMME
            : OperationType.OPERATION;

        // 🔑 Ajout d’un suffixe unique pour éviter les collisions
        const uniqueSuffix = randomUUID().slice(0, 6);

        const purchase = await prisma.purchase.create({
          data: {
            reference: `TST-${user.name.split(' ')[0].toUpperCase()}-${i}-${uniqueSuffix}`,
            year: 2026,
            site: 'Test Site',
            sequentialNumber: `${user.name.split(' ')[0]}-${i}-${uniqueSuffix}`,
            project: `Projet Test ${user.name} ${i}`,
            region,
            projectCode: `PRJ-${user.name.split(' ')[0]}-${i}-${uniqueSuffix}`,
            grantCode: `GNT-${user.name.split(' ')[0]}-${i}-${uniqueSuffix}`,
            activityCode: `ACT-${i}`,
            costCenter: `CC-${user.name.split(' ')[0]}-${i}`,
            title: `Achat ${status} de ${user.name} ${i}`,
            description: `Description détaillée pour l'achat ${i} de ${user.name}. Statut: ${status}. Région: ${region}.`,
            marketType,
            amount: totalAmount,
            operationType,
            requestedDeliveryDate: new Date(
              `2026-${Math.floor(Math.random() * 12) + 1}-${Math.floor(Math.random() * 28) + 1}`,
            ),
            priority,
            justification: `Justification pour l'achat ${i} de ${user.name}. Nécessaire pour les tests API.`,
            deliveryAddress: `Adresse de livraison ${region}`,
            status,
            currentStep: PurchaseStep.BC,
            creatorId: user.id,
            ...(status === PurchaseStatus.VALIDATED && {
              validatedAt: new Date(),
            }),
          },
        });

        userPurchases.push(purchase);
      }

      allPurchases.push(...userPurchases);
      console.log(
        `✅ Created ${userPurchases.length} purchases for ${user.name}`,
      );
    }

    console.log('\n🎉 Statistics test data seeded successfully!\n');
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

seedStatisticsData().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
