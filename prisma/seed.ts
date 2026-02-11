import 'dotenv/config'; // ← Très important : charge les .env

import {
  Role,
  OperationType,
  PurchaseStatus,
  PurchaseStep,
  AttachmentType,
  ValidatorRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString =
  process.env.NODE_ENV === 'development'
    ? process.env.DATABASE_URL_DEV
    : process.env.DATABASE_URL_PROD;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL_DEV (ou DATABASE_URL_PROD) est manquant dans les variables d'environnement",
  );
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool, { schema: 'public' });

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(' Starting database seeding...');

  // ==================== USERS ====================
  console.log(' Creating users...');

  const hashedPassword = await bcrypt.hash('Password123!', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@osdrm.mg',
      password: hashedPassword,
      name: 'Admin Principal',
      fonction: 'Administrateur Système',
      role: Role.ADMIN,
      isActive: true,
    },
  });

  const ceo = await prisma.user.create({
    data: {
      email: 'ceo@osdrm.mg',
      password: hashedPassword,
      name: 'Jean Rakoto',
      fonction: 'Directeur Général',
      role: Role.CEO,
      isActive: true,
    },
  });

  const cfo = await prisma.user.create({
    data: {
      email: 'cfo@osdrm.mg',
      password: hashedPassword,
      name: 'Marie Rasoa',
      fonction: 'Directeur Financier',
      role: Role.CFO,
      isActive: true,
    },
  });

  const dp = await prisma.user.create({
    data: {
      email: 'dp@osdrm.mg',
      password: hashedPassword,
      name: 'Paul Ravelo',
      fonction: 'Directeur de Programme',
      role: Role.DP,
      isActive: true,
    },
  });

  const om = await prisma.user.create({
    data: {
      email: 'om@osdrm.mg',
      password: hashedPassword,
      name: 'Sophie Rabe',
      fonction: 'Operations Manager',
      role: Role.OM,
      isActive: true,
    },
  });

  const demandeur1 = await prisma.user.create({
    data: {
      email: 'demandeur1@osdrm.mg',
      password: hashedPassword,
      name: 'Pierre Andry',
      fonction: 'Chef de Projet',
      role: Role.DEMANDEUR,
      isActive: true,
    },
  });

  const demandeur2 = await prisma.user.create({
    data: {
      email: 'demandeur2@osdrm.mg',
      password: hashedPassword,
      name: 'Julie Fara',
      fonction: 'Responsable Logistique',
      role: Role.DEMANDEUR,
      isActive: true,
    },
  });

  console.log(' Created 7 users');

  // ==================== PURCHASES ====================
  console.log(' Creating purchases...');

  const purchase1 = await prisma.purchase.create({
    data: {
      reference: 'DA-2026-001',
      year: 2026,
      site: 'Antananarivo',
      sequentialNumber: '001',
      project: 'PROJET HEALTH',
      region: 'Analamanga',
      projectCode: 'PRJ-2026-001',
      grantCode: 'GNT-2026-H01',
      activityCode: 'ACT-001',
      costCenter: 'CC-HEALTH-001',
      title: 'Fournitures médicales urgentes',
      description: 'Achat de matériel médical pour le centre de santé de base',
      marketType: 'Consultation',
      amount: 15000000,
      operationType: OperationType.PROGRAMME,
      requestedDeliveryDate: new Date('2026-03-15'),
      priority: 'HAUTE',
      justification: 'Besoin urgent pour la campagne de vaccination',
      deliveryAddress: 'Centre de Santé de Base, Antananarivo',
      status: PurchaseStatus.PUBLISHED,
      currentStep: PurchaseStep.DA,
      creatorId: demandeur1.id,
      items: {
        create: [
          {
            designation: 'Seringues jetables 5ml',
            quantity: 1000,
            unitPrice: 500,
            amount: 500000,
            unit: 'pièce',
            specifications: 'Conformes aux normes ISO',
          },
          {
            designation: 'Gants médicaux taille M',
            quantity: 500,
            unitPrice: 1000,
            amount: 500000,
            unit: 'boîte',
            specifications: 'Boîtes de 100 pièces, latex',
          },
          {
            designation: 'Masques chirurgicaux',
            quantity: 2000,
            unitPrice: 300,
            amount: 600000,
            unit: 'pièce',
            specifications: 'Type IIR, 3 plis',
          },
        ],
      },
    },
  });

  const purchase2 = await prisma.purchase.create({
    data: {
      reference: 'DA-2026-002',
      year: 2026,
      site: 'Toamasina',
      sequentialNumber: '002',
      project: 'PROJET EDUCATION',
      region: 'Atsinanana',
      projectCode: 'PRJ-2026-002',
      grantCode: 'GNT-2026-E01',
      activityCode: 'ACT-002',
      costCenter: 'CC-EDU-001',
      title: 'Matériel informatique pour école',
      description: 'Ordinateurs et équipements pour la salle informatique',
      marketType: "Appel d'offres",
      amount: 45000000,
      operationType: OperationType.OPERATION,
      requestedDeliveryDate: new Date('2026-04-01'),
      priority: 'MOYENNE',
      justification: "Modernisation de l'infrastructure informatique",
      deliveryAddress: 'EPP Toamasina Centre',
      status: PurchaseStatus.VALIDATED,
      currentStep: PurchaseStep.QR,
      creatorId: demandeur2.id,
      validatedAt: new Date(),
      items: {
        create: [
          {
            designation: 'Ordinateur portable Dell',
            quantity: 20,
            unitPrice: 2000000,
            amount: 40000000,
            unit: 'unité',
            specifications: 'RAM 8GB, SSD 256GB, écran 15.6"',
          },
          {
            designation: 'Projecteur multimédia',
            quantity: 2,
            unitPrice: 2500000,
            amount: 5000000,
            unit: 'unité',
            specifications: 'Full HD, 3000 lumens',
          },
        ],
      },
    },
  });

  const purchase3 = await prisma.purchase.create({
    data: {
      reference: 'DA-2026-003',
      year: 2026,
      site: 'Fianarantsoa',
      sequentialNumber: '003',
      project: 'PROJET AGRICULTURE',
      region: 'Haute Matsiatra',
      projectCode: 'PRJ-2026-003',
      grantCode: 'GNT-2026-A01',
      activityCode: 'ACT-003',
      costCenter: 'CC-AGRI-001',
      title: 'Équipements agricoles pour coopérative',
      description: 'Matériel pour améliorer la productivité agricole',
      marketType: 'Gré à gré',
      amount: 25000000,
      operationType: OperationType.PROGRAMME,
      requestedDeliveryDate: new Date('2026-03-20'),
      priority: 'HAUTE',
      justification: 'Saison de plantation imminente',
      deliveryAddress: 'Coopérative FANOME, Fianarantsoa',
      status: PurchaseStatus.DRAFT,
      currentStep: PurchaseStep.DA,
      creatorId: demandeur1.id,
      items: {
        create: [
          {
            designation: 'Motoculteur',
            quantity: 3,
            unitPrice: 5000000,
            amount: 15000000,
            unit: 'unité',
            specifications: 'Diesel, 8CV',
          },
          {
            designation: 'Semences de riz amélioré',
            quantity: 500,
            unitPrice: 10000,
            amount: 5000000,
            unit: 'kg',
            specifications: 'Variété résistante à la sécheresse',
          },
          {
            designation: 'Engrais NPK',
            quantity: 1000,
            unitPrice: 5000,
            amount: 5000000,
            unit: 'kg',
            specifications: 'NPK 15-15-15',
          },
        ],
      },
    },
  });

  // ==================== TEST WORKFLOWS - Pour tester chaque rôle ====================
  // Achat 4: DEMANDEUR validé → tester OM
  const purchase4 = await prisma.purchase.create({
    data: {
      reference: 'DA-2026-004',
      year: 2026,
      site: 'Antsirabe',
      sequentialNumber: '004',
      project: 'PROJET TEST - WORKFLOW OM',
      region: 'Vakinankaratra',
      projectCode: 'PRJ-2026-004',
      grantCode: 'GNT-2026-T01',
      activityCode: 'ACT-004',
      costCenter: 'CC-TEST-001',
      title: 'Achat test - Validation demandeur OK',
      description: 'Achat déjà validé par demandeur pour tester validation OM',
      marketType: 'Consultation',
      amount: 12000000,
      operationType: OperationType.PROGRAMME,
      requestedDeliveryDate: new Date('2026-03-30'),
      priority: 'HAUTE',
      justification: 'Test workflow - OM en attente',
      deliveryAddress: 'Antsirabe Centre',
      status: PurchaseStatus.PUBLISHED,
      currentStep: PurchaseStep.DA,
      creatorId: demandeur1.id,
      items: {
        create: [
          {
            designation: 'Article test 1',
            quantity: 100,
            unitPrice: 50000,
            amount: 5000000,
            unit: 'unité',
          },
        ],
      },
    },
  });

  // Achat 5: DEMANDEUR + OM validés → tester DP
  const purchase5 = await prisma.purchase.create({
    data: {
      reference: 'DA-2026-005',
      year: 2026,
      site: 'Mahajanga',
      sequentialNumber: '005',
      project: 'PROJET TEST - WORKFLOW DP',
      region: 'Boeny',
      projectCode: 'PRJ-2026-005',
      grantCode: 'GNT-2026-T02',
      activityCode: 'ACT-005',
      costCenter: 'CC-TEST-002',
      title: 'Achat test - Validation demandeur + OM OK',
      description: 'Achat validé par demandeur et OM pour tester validation DP',
      marketType: "Appel d'offres",
      amount: 18000000,
      operationType: OperationType.OPERATION,
      requestedDeliveryDate: new Date('2026-04-10'),
      priority: 'MOYENNE',
      justification: 'Test workflow - DP en attente',
      deliveryAddress: 'Mahajanga Port',
      status: PurchaseStatus.PUBLISHED,
      currentStep: PurchaseStep.DA,
      creatorId: demandeur2.id,
      items: {
        create: [
          {
            designation: 'Article test 2',
            quantity: 200,
            unitPrice: 75000,
            amount: 15000000,
            unit: 'unité',
          },
        ],
      },
    },
  });

  // Achat 6: DEMANDEUR + OM + DP validés → tester CFO
  const purchase6 = await prisma.purchase.create({
    data: {
      reference: 'DA-2026-006',
      year: 2026,
      site: 'Antalaha',
      sequentialNumber: '006',
      project: 'PROJET TEST - WORKFLOW CFO',
      region: 'Sambava',
      projectCode: 'PRJ-2026-006',
      grantCode: 'GNT-2026-T03',
      activityCode: 'ACT-006',
      costCenter: 'CC-TEST-003',
      title: 'Achat test - Validation demandeur + OM + DP OK',
      description:
        'Achat validé par demandeur, OM et DP pour tester validation CFO',
      marketType: 'Gré à gré',
      amount: 22000000,
      operationType: OperationType.PROGRAMME,
      requestedDeliveryDate: new Date('2026-04-20'),
      priority: 'HAUTE',
      justification: 'Test workflow - CFO en attente',
      deliveryAddress: 'Antalaha NORD',
      status: PurchaseStatus.PUBLISHED,
      currentStep: PurchaseStep.DA,
      creatorId: demandeur1.id,
      items: {
        create: [
          {
            designation: 'Article test 3',
            quantity: 300,
            unitPrice: 60000,
            amount: 18000000,
            unit: 'unité',
          },
        ],
      },
    },
  });

  console.log(` Created 6 purchases total (3 standards + 3 tests de workflow)`);

  // ==================== WORKFLOW + ATTACHMENTS + AUDIT LOGS ====================
  console.log(' Creating validation workflows...');

  // Workflow pour purchase2 (original): DEMANDEUR + OM validés, DP + CFO en attente
  await prisma.validationWorkflow.create({
    data: {
      purchaseId: purchase2.id,
      currentStep: 2,
      isComplete: false,
      validators: {
        create: [
          {
            role: ValidatorRole.DEMANDEUR,
            order: 1,
            userId: demandeur2.id,
            name: demandeur2.name,
            email: demandeur2.email,
            isValidated: true,
            validatedAt: new Date('2026-02-05'),
            decision: 'APPROVED',
            comment: 'Demande conforme aux besoins',
          },
          {
            role: ValidatorRole.OM,
            order: 2,
            userId: om.id,
            name: om.name,
            email: om.email,
            isValidated: true,
            validatedAt: new Date('2026-02-06'),
            decision: 'APPROVED',
            comment: 'Budget disponible, validation accordée',
          },
          {
            role: ValidatorRole.DP,
            order: 3,
            userId: dp.id,
            name: dp.name,
            email: dp.email,
            isValidated: false,
            decision: 'PENDING',
          },
          {
            role: ValidatorRole.CFO,
            order: 4,
            userId: cfo.id,
            name: cfo.name,
            email: cfo.email,
            isValidated: false,
          },
        ],
      },
    },
  });

  // Workflow pour purchase4: DEMANDEUR validé → DP en attente (PROGRAMME 12M: pas d'OM)
  await prisma.validationWorkflow.create({
    data: {
      purchaseId: purchase4.id,
      currentStep: 1,
      isComplete: false,
      validators: {
        create: [
          {
            role: ValidatorRole.DEMANDEUR,
            order: 1,
            userId: demandeur1.id,
            name: demandeur1.name,
            email: demandeur1.email,
            isValidated: true,
            validatedAt: new Date('2026-02-07'),
            decision: 'APPROVED',
            comment: 'Fourniture conforme aux spécifications',
          },
          {
            role: ValidatorRole.DP,
            order: 2,
            userId: dp.id,
            name: dp.name,
            email: dp.email,
            isValidated: false,
            decision: 'PENDING',
          },
          {
            role: ValidatorRole.CFO,
            order: 3,
            userId: cfo.id,
            name: cfo.name,
            email: cfo.email,
            isValidated: false,
          },
          {
            role: ValidatorRole.CEO,
            order: 4,
            userId: ceo.id,
            name: ceo.name,
            email: ceo.email,
            isValidated: false,
          },
        ],
      },
    },
  });

  // Workflow pour purchase5: DEMANDEUR validé → OM en attente (OPERATION 18M: pas de DP)
  await prisma.validationWorkflow.create({
    data: {
      purchaseId: purchase5.id,
      currentStep: 1,
      isComplete: false,
      validators: {
        create: [
          {
            role: ValidatorRole.DEMANDEUR,
            order: 1,
            userId: demandeur2.id,
            name: demandeur2.name,
            email: demandeur2.email,
            isValidated: true,
            validatedAt: new Date('2026-02-07'),
            decision: 'APPROVED',
            comment: 'Demande validée',
          },
          {
            role: ValidatorRole.OM,
            order: 2,
            userId: om.id,
            name: om.name,
            email: om.email,
            isValidated: false,
            decision: 'PENDING',
          },
          {
            role: ValidatorRole.CFO,
            order: 3,
            userId: cfo.id,
            name: cfo.name,
            email: cfo.email,
            isValidated: false,
          },
          {
            role: ValidatorRole.CEO,
            order: 4,
            userId: ceo.id,
            name: ceo.name,
            email: ceo.email,
            isValidated: false,
          },
        ],
      },
    },
  });

  // Workflow pour purchase6: DEMANDEUR + DP validés → CFO en attente (PROGRAMME 22M: pas d'OM)
  await prisma.validationWorkflow.create({
    data: {
      purchaseId: purchase6.id,
      currentStep: 2,
      isComplete: false,
      validators: {
        create: [
          {
            role: ValidatorRole.DEMANDEUR,
            order: 1,
            userId: demandeur1.id,
            name: demandeur1.name,
            email: demandeur1.email,
            isValidated: true,
            validatedAt: new Date('2026-02-07'),
            decision: 'APPROVED',
            comment: 'Demande initiale validée',
          },
          {
            role: ValidatorRole.DP,
            order: 2,
            userId: dp.id,
            name: dp.name,
            email: dp.email,
            isValidated: true,
            validatedAt: new Date('2026-02-08'),
            decision: 'APPROVED',
            comment: 'Alignement avec les priorités du programme vérifié',
          },
          {
            role: ValidatorRole.CFO,
            order: 3,
            userId: cfo.id,
            name: cfo.name,
            email: cfo.email,
            isValidated: false,
            decision: 'PENDING',
          },
          {
            role: ValidatorRole.CEO,
            order: 4,
            userId: ceo.id,
            name: ceo.name,
            email: ceo.email,
            isValidated: false,
          },
        ],
      },
    },
  });

  console.log(' Creating attachments...');
  await prisma.attachment.createMany({
    data: [
      {
        purchaseId: purchase1.id,
        type: AttachmentType.QUOTE,
        fileName: 'devis_materiel_medical.pdf',
        fileUrl: 's3://osdrm-bucket/attachments/devis_medical_001.pdf',
        fileSize: 250000,
        mimeType: 'application/pdf',
        description: 'Devis fournisseur pour matériel médical',
        uploadedBy: demandeur1.email,
        receivedAt: new Date('2026-02-03'),
      },
      {
        purchaseId: purchase2.id,
        type: AttachmentType.QUOTE,
        fileName: 'devis_ordinateurs.pdf',
        fileUrl: 's3://osdrm-bucket/attachments/devis_it_002.pdf',
        fileSize: 180000,
        mimeType: 'application/pdf',
        description: 'Devis Dell pour équipements informatiques',
        uploadedBy: demandeur2.email,
        receivedAt: new Date('2026-02-04'),
      },
    ],
  });

  console.log(' Creating audit logs...');
  await prisma.auditLog.createMany({
    data: [
      {
        userId: demandeur1.id,
        action: 'PURCHASE_CREATED',
        resource: 'Purchase',
        resourceId: purchase1.id,
        details: {
          reference: 'DA-2026-001',
          title: 'Fournitures médicales urgentes',
        },
      },
      {
        userId: demandeur2.id,
        action: 'PURCHASE_CREATED',
        resource: 'Purchase',
        resourceId: purchase2.id,
        details: {
          reference: 'DA-2026-002',
          title: 'Matériel informatique pour école',
        },
      },
      {
        userId: demandeur2.id,
        action: 'VALIDATION_SUBMITTED',
        resource: 'Purchase',
        resourceId: purchase2.id,
        details: {
          reference: 'DA-2026-002',
          validator: demandeur2.name,
          decision: 'APPROVED',
        },
      },
      {
        userId: om.id,
        action: 'VALIDATION_SUBMITTED',
        resource: 'Purchase',
        resourceId: purchase2.id,
        details: {
          reference: 'DA-2026-002',
          validator: om.name,
          decision: 'APPROVED',
        },
      },
    ],
  });

  // ==================== RÉSUMÉ FINAL ====================
  console.log('\n════════════════════════════════════════════════════════');
  console.log(' ✓ Seeding completed successfully!\n');
  console.log(' 📊 DATA SUMMARY:');
  console.log(`   • ${7} Users créés`);
  console.log(`   • ${6} Purchases créés (3 standards + 3 workflows tests)`);
  console.log(`   • ${4} Validation Workflows créés`);
  console.log(`   • ${2} Attachments créés`);
  console.log(`   • ${4} Audit Logs créés\n`);
  console.log(' 🧪 TEST WORKFLOWS:');
  console.log(
    `   • purchase4 (DA-2026-004): DEMANDEUR validé → DP en attente (PROGRAMME 12M)`,
  );
  console.log(
    `   • purchase5 (DA-2026-005): DEMANDEUR validé → OM en attente (OPERATION 18M)`,
  );
  console.log(
    `   • purchase6 (DA-2026-006): DEMANDEUR + DP validés → CFO en attente (PROGRAMME 22M)\n`,
  );
  console.log(' 👤 USER CREDENTIALS (mot de passe pour tous: Password123!)');
  console.log(`   • admin@osdrm.mg (ADMIN)`);
  console.log(`   • ceo@osdrm.mg (CEO)`);
  console.log(`   • cfo@osdrm.mg (CFO)`);
  console.log(`   • dp@osdrm.mg (DP)`);
  console.log(`   • om@osdrm.mg (OM)`);
  console.log(`   • demandeur1@osdrm.mg (DEMANDEUR)`);
  console.log(`   • demandeur2@osdrm.mg (DEMANDEUR)\n`);
  console.log('════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error(' Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
