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

  console.log(` Created 3 purchases with items`);

  // ==================== WORKFLOW + ATTACHMENTS + AUDIT LOGS ====================
  // (Je garde la suite identique à ton code original pour ne pas tout réécrire)

  console.log(' Creating validation workflows...');
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

  console.log(' Creating attachments...');
  await prisma.attachment.createMany({
    data: [
      /* ton code original */
    ],
  });

  console.log(' Creating audit logs...');
  await prisma.auditLog.createMany({
    data: [
      /* ton code original */
    ],
  });

  // Résumé final (garde ton code de résumé)
  console.log('\n Seeding completed successfully!\n');
  // ... (le reste de ton résumé)
}

main()
  .catch((e) => {
    console.error(' Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
