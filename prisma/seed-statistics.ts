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
    // Créer 5 utilisateurs avec différents rôles pour tester en profondeur
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

    // Statuts disponibles pour les achats
    const allStatuses = [
      PurchaseStatus.DRAFT,
      PurchaseStatus.PUBLISHED,
      PurchaseStatus.VALIDATED,
      PurchaseStatus.REJECTED,
      PurchaseStatus.IN_DEROGATION,
    ];

    // Régions pour diversité
    const regions = [
      'Analamanga',
      'Atsinanana',
      'Vakinankaratra',
      'Diana',
      'Sava',
    ];

    // Types de marché
    const marketTypes = [
      'Consultation',
      "Appel d'offres",
      'Direct',
      'Concours',
    ];

    // Priorités
    const priorities = ['MOYENNE', 'URGENT', 'TRES_URGENT'];

    // Étapes
    const steps = [
      PurchaseStep.DA,
      PurchaseStep.QR,
      PurchaseStep.DAP,
      PurchaseStep.BC,
    ];

    // Créer des achats aléatoires pour chaque utilisateur
    const allPurchases: Purchase[] = [];

    for (const user of users) {
      console.log(`\n📦 Creating purchases for ${user.name}...`);
      const userPurchases: Purchase[] = [];

      // Chaque utilisateur aura entre 5 et 10 achats
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
        const totalAmount = Math.floor(Math.random() * 10000) + 1000; // 1000 à 11000
        const operationType =
          Math.random() > 0.5
            ? OperationType.PROGRAMME
            : OperationType.OPERATION;

        const purchase = await prisma.purchase.create({
          data: {
            reference: `TST-${user.name.split(' ')[0].toUpperCase()}-${i}`,
            year: 2026,
            site: 'Test Site',
            sequentialNumber: `${user.name.split(' ')[0]}-${i}`,
            project: `Projet Test ${user.name} ${i}`,
            region: region,
            projectCode: `PRJ-${user.name.split(' ')[0]}-${i}`,
            grantCode: `GNT-${user.name.split(' ')[0]}-${i}`,
            activityCode: `ACT-${i}`,
            costCenter: `CC-${user.name.split(' ')[0]}-${i}`,
            title: `Achat ${status} de ${user.name} ${i}`,
            description: `Description détaillée pour l'achat ${i} de ${user.name}. Statut: ${status}. Région: ${region}.`,
            marketType: marketType,
            operationType: operationType,
            requestedDeliveryDate: new Date(
              `2026-${Math.floor(Math.random() * 12) + 1}-${Math.floor(Math.random() * 28) + 1}`,
            ),
            priority: priority,
            justification: `Justification pour l'achat ${i} de ${user.name}. Nécessaire pour les tests API.`,
            deliveryAddress: `Adresse de livraison ${region}`,
            status: status,
            currentStep: step,
            creatorId: user.id,
            ...(status === PurchaseStatus.VALIDATED && {
              validatedAt: new Date(),
            }),
          },
        });

        // Créer des items pour cet achat (1 à 5 items)
        const itemCount = Math.floor(Math.random() * 5) + 1;
        const itemAmount = totalAmount / itemCount;

        for (let j = 1; j <= itemCount; j++) {
          await prisma.purchaseItem.create({
            data: {
              purchaseId: purchase.id,
              designation: `Article ${j} pour achat ${i} de ${user.name}`,
              quantity: Math.floor(Math.random() * 10) + 1,
              unitPrice: itemAmount / (Math.floor(Math.random() * 5) + 1),
              amount: itemAmount,
              unit: ['pièce', 'kg', 'litre', 'mètre'][
                Math.floor(Math.random() * 4)
              ],
              specifications: `Spécifications détaillées pour l'article ${j}. Nécessaire pour les tests.`,
            },
          });
        }

        // Créer des devis pour certains achats (si PUBLISHED ou VALIDATED)
        if (
          status === PurchaseStatus.PUBLISHED ||
          status === PurchaseStatus.VALIDATED
        ) {
          const quotationCount = Math.floor(Math.random() * 3) + 1;
          for (let k = 1; k <= quotationCount; k++) {
            // Note: Since there's no Quotation model, we'll create attachments of type QUOTE instead
            await prisma.attachment.create({
              data: {
                purchaseId: purchase.id,
                type: 'QUOTE',
                fileName: `devis_${k}_${user.name.split(' ')[0]}.pdf`,
                fileUrl: `/uploads/quotes/devis_${k}_${user.name.split(' ')[0]}.pdf`,
                fileSize: Math.floor(Math.random() * 1000000) + 100000, // 100KB to 1MB
                mimeType: 'application/pdf',
                description: `Devis ${k} pour l'achat ${i} de ${user.name}`,
                uploadedBy: user.name,
              },
            });
          }
        }

        // Créer des dérogations pour certains achats (si IN_DEROGATION)
        if (status === PurchaseStatus.IN_DEROGATION) {
          await prisma.derogation.create({
            data: {
              purchaseId: purchase.id,
              reason: `Raison de dérogation pour l'achat ${i} de ${user.name}`,
              justification: `Justification détaillée pour la dérogation de l'achat ${i}`,
              status: Math.random() > 0.5 ? 'VALIDATED' : 'PENDING',
            },
          });
        }

        userPurchases.push(purchase);
      }

      allPurchases.push(...userPurchases);
      console.log(
        `✅ Created ${userPurchases.length} purchases for ${user.name}`,
      );
    }

    // Résumé des données créées
    console.log('\n📊 Summary of test data:');
    console.log(`   - Users created: ${users.length}`);
    console.log(`   - Total purchases: ${allPurchases.length}`);

    const statusCounts = allStatuses.map((status) => ({
      status,
      count: allPurchases.filter((p) => p.status === status).length,
    }));

    statusCounts.forEach(({ status, count }) => {
      if (count > 0) {
        console.log(`   - ${status}: ${count} purchases`);
      }
    });

    const totalAmount = allPurchases.length * 0;
    console.log(`   - Total amount: N/A (calculé depuis les items)\n`);

    console.log('🎉 Statistics test data seeded successfully!\n');
    console.log('🔗 Test endpoints:');
    console.log('   - GET http://localhost:3000/statistics/purchases');
    console.log('   - GET http://localhost:3000/purchase');
    console.log(
      '   - GET http://localhost:3000/auth/login (use any user email with password: Password123!)\n',
    );
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Exécuter le seeding
seedStatisticsData().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
