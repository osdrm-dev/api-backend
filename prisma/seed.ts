import 'dotenv/config';

import {
  Role,
  OperationType,
  PurchaseStatus,
  PurchaseStep,
  AttachmentType,
  ValidatorRole,
  PVStatus,
  DerogationStatus,
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

// ─────────────────────────────────────────────────────────────────────────────
// NETTOYAGE (ordre inverse des dépendances FK)
// ─────────────────────────────────────────────────────────────────────────────
async function cleanup() {
  console.log('🧹 Suppression des données existantes...');
  await prisma.auditLog.deleteMany();
  await prisma.pVSupplierItem.deleteMany();
  await prisma.pVSupplier.deleteMany();
  await prisma.pV.deleteMany();
  await prisma.validator.deleteMany();
  await prisma.validationWorkflow.deleteMany();
  await prisma.derogation.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.purchaseItem.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.file.deleteMany();
  await prisma.user.deleteMany();
  console.log('✅ Base de données nettoyée\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — génère les validators d'un workflow DA entièrement approuvé
// ─────────────────────────────────────────────────────────────────────────────
function daApprovedValidators(
  users: {
    demandeur: { id: number; name: string; email: string };
    om?: { id: number; name: string; email: string };
    dp?: { id: number; name: string; email: string };
    cfo: { id: number; name: string; email: string };
    ceo: { id: number; name: string; email: string };
  },
  baseDate: Date,
) {
  const validators: any[] = [];
  let order = 0;
  const d = (offsetDays: number) =>
    new Date(baseDate.getTime() + offsetDays * 86400000);

  validators.push({
    role: ValidatorRole.DEMANDEUR,
    order: order++,
    userId: users.demandeur.id,
    name: users.demandeur.name,
    email: users.demandeur.email,
    isValidated: true,
    validatedAt: d(0),
    decision: 'APPROVED',
    comment: 'Publication de la demande',
  });
  if (users.om) {
    validators.push({
      role: ValidatorRole.OM,
      order: order++,
      userId: users.om.id,
      name: users.om.name,
      email: users.om.email,
      isValidated: true,
      validatedAt: d(1),
      decision: 'APPROVED',
      comment: 'Validé OM',
    });
  }
  if (users.dp) {
    validators.push({
      role: ValidatorRole.DP,
      order: order++,
      userId: users.dp.id,
      name: users.dp.name,
      email: users.dp.email,
      isValidated: true,
      validatedAt: d(2),
      decision: 'APPROVED',
      comment: 'Alignement programme OK',
    });
  }
  validators.push({
    role: ValidatorRole.CFO,
    order: order++,
    userId: users.cfo.id,
    name: users.cfo.name,
    email: users.cfo.email,
    isValidated: true,
    validatedAt: d(3),
    decision: 'APPROVED',
    comment: 'Budget disponible et validé',
  });
  validators.push({
    role: ValidatorRole.CEO,
    order: order++,
    userId: users.ceo.id,
    name: users.ceo.name,
    email: users.ceo.email,
    isValidated: true,
    validatedAt: d(4),
    decision: 'APPROVED',
    comment: 'Approbation finale',
  });
  return validators;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  await cleanup();

  // ══════════════════════════════════════════════════════════════
  // UTILISATEURS
  // ══════════════════════════════════════════════════════════════
  console.log('👤 Création des utilisateurs...');
  const pwd = await bcrypt.hash('Password123!', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@osdrm.mg',
      password: pwd,
      name: 'Admin Principal',
      fonction: 'Administrateur Système',
      role: Role.ADMIN,
    },
  });
  const ceo = await prisma.user.create({
    data: {
      email: 'ceo@osdrm.mg',
      password: pwd,
      name: 'Jean Rakoto',
      fonction: 'Directeur Général',
      role: Role.CEO,
    },
  });
  const cfo = await prisma.user.create({
    data: {
      email: 'cfo@osdrm.mg',
      password: pwd,
      name: 'Marie Rasoa',
      fonction: 'Directeur Financier',
      role: Role.CFO,
    },
  });
  const dp = await prisma.user.create({
    data: {
      email: 'dp@osdrm.mg',
      password: pwd,
      name: 'Paul Ravelo',
      fonction: 'Directeur de Programme',
      role: Role.DP,
    },
  });
  const om = await prisma.user.create({
    data: {
      email: 'om@osdrm.mg',
      password: pwd,
      name: 'Sophie Rabe',
      fonction: 'Operations Manager',
      role: Role.OM,
    },
  });
  const demandeur1 = await prisma.user.create({
    data: {
      email: 'demandeur1@osdrm.mg',
      password: pwd,
      name: 'Pierre Andry',
      fonction: 'Chef de Projet',
      role: Role.DEMANDEUR,
    },
  });
  const demandeur2 = await prisma.user.create({
    data: {
      email: 'demandeur2@osdrm.mg',
      password: pwd,
      name: 'Julie Fara',
      fonction: 'Responsable Logistique',
      role: Role.DEMANDEUR,
    },
  });
  const acheteur = await prisma.user.create({
    data: {
      email: 'acheteur@osdrm.mg',
      password: pwd,
      name: 'Marc Rivo',
      fonction: 'Acheteur',
      role: Role.ACHETEUR,
    },
  });
  console.log('✅ 8 utilisateurs créés\n');

  // ══════════════════════════════════════════════════════════════
  // FOURNISSEURS
  // ══════════════════════════════════════════════════════════════
  console.log('🏢 Création des fournisseurs...');
  const sup1 = await prisma.supplier.create({
    data: {
      name: 'Global Trade SARL',
      status: 'active',
      nif: '1001001001',
      stat: 'STAT001',
      rcs: 'RCS001',
      region: 'Analamanga',
      address: 'Lot II A 45, Antananarivo',
      phone: '+261 34 12 345 67',
      email: 'contact@globaltrade.mg',
      label: 'Informatique & bureautique',
    },
  });
  const sup2 = await prisma.supplier.create({
    data: {
      name: 'MedSupply Madagascar',
      status: 'active',
      nif: '2002002002',
      stat: 'STAT002',
      rcs: 'RCS002',
      region: 'Analamanga',
      address: 'Rue Andrianary, Antananarivo',
      phone: '+261 33 22 456 78',
      email: 'info@medsupply.mg',
      label: 'Équipements médicaux',
    },
  });
  const sup3 = await prisma.supplier.create({
    data: {
      name: 'AgroTech Mada',
      status: 'active',
      nif: '3003003003',
      stat: 'STAT003',
      rcs: 'RCS003',
      region: 'Haute Matsiatra',
      address: 'Ambohimandroso, Fianarantsoa',
      phone: '+261 32 11 789 01',
      email: 'agro@agrotech.mg',
      label: 'Matériel agricole',
    },
  });
  const sup4 = await prisma.supplier.create({
    data: {
      name: 'BoisMada Menuiserie',
      status: 'active',
      nif: '4004004004',
      stat: 'STAT004',
      rcs: 'RCS004',
      region: 'Analamanga',
      address: 'Zone Industrielle Tanjombato',
      phone: '+261 34 55 123 45',
      email: 'contact@boismada.mg',
      label: 'Mobilier scolaire',
    },
  });
  console.log('✅ 4 fournisseurs créés\n');

  console.log("📦 Création des dossiers d'achat...");

  // ══════════════════════════════════════════════════════════════
  // DA-001 — DRAFT | Brouillon non publié
  // ══════════════════════════════════════════════════════════════
  await prisma.purchase.create({
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
      title: '[DRAFT] Fournitures de bureau',
      description:
        'Renouvellement annuel des fournitures pour les équipes terrain',
      marketType: 'Consultation',
      operationType: OperationType.PROGRAMME,
      requestedDeliveryDate: new Date('2026-04-01'),
      priority: 'BASSE',
      justification: 'Renouvellement annuel des fournitures de bureau',
      deliveryAddress: 'Siège OSDRM, Antananarivo',
      status: PurchaseStatus.DRAFT,
      currentStep: PurchaseStep.DA,
      creatorId: demandeur1.id,
      items: {
        create: [
          {
            designation: 'Rames de papier A4',
            quantity: 50,
            unitPrice: 15000,
            amount: 750000,
            unit: 'rame',
          },
          {
            designation: 'Stylos bille bleus',
            quantity: 200,
            unitPrice: 500,
            amount: 100000,
            unit: 'pièce',
          },
          {
            designation: 'Classeurs A4',
            quantity: 100,
            unitPrice: 3500,
            amount: 350000,
            unit: 'pièce',
          },
        ],
      },
    },
  });

  // ══════════════════════════════════════════════════════════════
  // DA-002 — PUBLISHED / DA | En attente validation OM
  // ══════════════════════════════════════════════════════════════
  const p2 = await prisma.purchase.create({
    data: {
      reference: 'DA-2026-002',
      year: 2026,
      site: 'Antananarivo',
      sequentialNumber: '002',
      project: 'PROJET HEALTH',
      region: 'Analamanga',
      projectCode: 'PRJ-2026-001',
      grantCode: 'GNT-2026-H01',
      activityCode: 'ACT-002',
      costCenter: 'CC-HEALTH-001',
      title: '[DA] Matériel médical — en attente validation OM',
      description: 'Matériel médical pour campagne de vaccination',
      marketType: 'Consultation',
      operationType: OperationType.PROGRAMME,
      requestedDeliveryDate: new Date('2026-04-15'),
      priority: 'HAUTE',
      justification: 'Campagne de vaccination imminente, matériel nécessaire',
      deliveryAddress: 'Centre de Santé, Antananarivo',
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
            specifications: 'Conformes ISO',
          },
          {
            designation: 'Gants médicaux taille M',
            quantity: 500,
            unitPrice: 1000,
            amount: 500000,
            unit: 'boîte',
            specifications: 'Boîte 100 pièces, latex',
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
  await prisma.validationWorkflow.create({
    data: {
      purchaseId: p2.id,
      step: PurchaseStep.DA,
      currentStep: 1,
      isComplete: false,
      validators: {
        create: [
          {
            role: ValidatorRole.DEMANDEUR,
            order: 0,
            userId: demandeur1.id,
            name: demandeur1.name,
            email: demandeur1.email,
            isValidated: true,
            validatedAt: new Date('2026-02-10'),
            decision: 'APPROVED',
            comment: 'Publication de la demande',
          },
          {
            role: ValidatorRole.OM,
            order: 1,
            userId: om.id,
            name: om.name,
            email: om.email,
            isValidated: false,
          },
          {
            role: ValidatorRole.CFO,
            order: 2,
            userId: cfo.id,
            name: cfo.name,
            email: cfo.email,
            isValidated: false,
          },
          {
            role: ValidatorRole.CEO,
            order: 3,
            userId: ceo.id,
            name: ceo.name,
            email: ceo.email,
            isValidated: false,
          },
        ],
      },
    },
  });

  // ══════════════════════════════════════════════════════════════
  // DA-003 — PUBLISHED / DA | En attente validation DP (OM déjà validé)
  // ══════════════════════════════════════════════════════════════
  const p3 = await prisma.purchase.create({
    data: {
      reference: 'DA-2026-003',
      year: 2026,
      site: 'Mahajanga',
      sequentialNumber: '003',
      project: 'PROJET AGRICULTURE',
      region: 'Boeny',
      projectCode: 'PRJ-2026-003',
      grantCode: 'GNT-2026-A01',
      activityCode: 'ACT-003',
      costCenter: 'CC-AGRI-001',
      title: '[DA] Semences certifiées — en attente validation DP',
      description:
        'Semences pour distribution aux agriculteurs de la région Boeny',
      marketType: 'Consultation',
      operationType: OperationType.PROGRAMME,
      requestedDeliveryDate: new Date('2026-03-30'),
      priority: 'HAUTE',
      justification: 'Distribution avant la saison des pluies',
      deliveryAddress: 'Direction Régionale Agriculture, Mahajanga',
      status: PurchaseStatus.PUBLISHED,
      currentStep: PurchaseStep.DA,
      creatorId: demandeur2.id,
      items: {
        create: [
          {
            designation: 'Semences riz SEBOTA',
            quantity: 2000,
            unitPrice: 8000,
            amount: 16000000,
            unit: 'kg',
            specifications: 'Certifiées R1, taux germination >95%',
          },
          {
            designation: 'Semences maïs hybride F1',
            quantity: 500,
            unitPrice: 12000,
            amount: 6000000,
            unit: 'kg',
          },
        ],
      },
    },
  });
  await prisma.validationWorkflow.create({
    data: {
      purchaseId: p3.id,
      step: PurchaseStep.DA,
      currentStep: 2,
      isComplete: false,
      validators: {
        create: [
          {
            role: ValidatorRole.DEMANDEUR,
            order: 0,
            userId: demandeur2.id,
            name: demandeur2.name,
            email: demandeur2.email,
            isValidated: true,
            validatedAt: new Date('2026-02-12'),
            decision: 'APPROVED',
          },
          {
            role: ValidatorRole.OM,
            order: 1,
            userId: om.id,
            name: om.name,
            email: om.email,
            isValidated: true,
            validatedAt: new Date('2026-02-13'),
            decision: 'APPROVED',
            comment: 'Budget disponible',
          },
          {
            role: ValidatorRole.DP,
            order: 2,
            userId: dp.id,
            name: dp.name,
            email: dp.email,
            isValidated: false,
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

  // ══════════════════════════════════════════════════════════════
  // DA-004 — PENDING_APPROVAL / DA | En attente approbation CEO
  // ══════════════════════════════════════════════════════════════
  const p4 = await prisma.purchase.create({
    data: {
      reference: 'DA-2026-004',
      year: 2026,
      site: 'Toamasina',
      sequentialNumber: '004',
      project: 'PROJET EDUCATION',
      region: 'Atsinanana',
      projectCode: 'PRJ-2026-002',
      grantCode: 'GNT-2026-E01',
      activityCode: 'ACT-004',
      costCenter: 'CC-EDU-001',
      title: '[DA PENDING CEO] Matériel informatique — en attente CEO',
      description: 'Ordinateurs pour salle informatique EPP Toamasina',
      marketType: "Appel d'offres",
      operationType: OperationType.OPERATION,
      requestedDeliveryDate: new Date('2026-05-01'),
      priority: 'MOYENNE',
      justification: "Modernisation de l'infrastructure informatique scolaire",
      deliveryAddress: 'EPP Toamasina Centre',
      status: PurchaseStatus.PENDING_APPROVAL,
      currentStep: PurchaseStep.DA,
      creatorId: demandeur2.id,
      items: {
        create: [
          {
            designation: 'Ordinateur portable Dell',
            quantity: 20,
            unitPrice: 2000000,
            amount: 40000000,
            unit: 'unité',
            specifications: 'RAM 8GB, SSD 256GB, 15.6"',
          },
          {
            designation: 'Projecteur multimédia Full HD',
            quantity: 2,
            unitPrice: 2500000,
            amount: 5000000,
            unit: 'unité',
            specifications: '3000 lumens, Full HD',
          },
        ],
      },
    },
  });
  await prisma.validationWorkflow.create({
    data: {
      purchaseId: p4.id,
      step: PurchaseStep.DA,
      currentStep: 3,
      isComplete: false,
      validators: {
        create: [
          {
            role: ValidatorRole.DEMANDEUR,
            order: 0,
            userId: demandeur2.id,
            name: demandeur2.name,
            email: demandeur2.email,
            isValidated: true,
            validatedAt: new Date('2026-02-14'),
            decision: 'APPROVED',
          },
          {
            role: ValidatorRole.OM,
            order: 1,
            userId: om.id,
            name: om.name,
            email: om.email,
            isValidated: true,
            validatedAt: new Date('2026-02-15'),
            decision: 'APPROVED',
            comment: 'OK opérations',
          },
          {
            role: ValidatorRole.CFO,
            order: 2,
            userId: cfo.id,
            name: cfo.name,
            email: cfo.email,
            isValidated: true,
            validatedAt: new Date('2026-02-16'),
            decision: 'APPROVED',
            comment: 'Budget validé',
          },
          {
            role: ValidatorRole.CEO,
            order: 3,
            userId: ceo.id,
            name: ceo.name,
            email: ceo.email,
            isValidated: false,
          },
        ],
      },
    },
  });

  // ══════════════════════════════════════════════════════════════
  // DA-005 — CHANGE_REQUESTED | Modification demandée
  // ══════════════════════════════════════════════════════════════
  await prisma.purchase.create({
    data: {
      reference: 'DA-2026-005',
      year: 2026,
      site: 'Antananarivo',
      sequentialNumber: '005',
      project: 'PROJET HEALTH',
      region: 'Analamanga',
      projectCode: 'PRJ-2026-001',
      grantCode: 'GNT-2026-H01',
      activityCode: 'ACT-005',
      costCenter: 'CC-HEALTH-001',
      title: '[CHANGE REQUESTED] Ambulances — spécifications à revoir',
      description: 'Ambulances médicalisées pour le réseau de santé',
      marketType: "Appel d'offres",
      operationType: OperationType.PROGRAMME,
      requestedDeliveryDate: new Date('2026-06-01'),
      priority: 'HAUTE',
      justification: "Renforcement du réseau d'urgences médicales",
      deliveryAddress: 'DRSP Antananarivo',
      status: PurchaseStatus.CHANGE_REQUESTED,
      currentStep: PurchaseStep.DA,
      observations:
        'DP: Spécifications trop vagues — préciser marque, motorisation, équipements médicaux intégrés et normes de sécurité. Resoumission requise.',
      creatorId: demandeur1.id,
      items: {
        create: [
          {
            designation: 'Ambulance médicalisée',
            quantity: 3,
            unitPrice: 55000000,
            amount: 165000000,
            unit: 'unité',
            specifications: 'À préciser',
          },
        ],
      },
    },
  });

  // ══════════════════════════════════════════════════════════════
  // DA-006 — REJECTED / DA | Rejeté par CFO
  // ══════════════════════════════════════════════════════════════
  const p6 = await prisma.purchase.create({
    data: {
      reference: 'DA-2026-006',
      year: 2026,
      site: 'Taolagnaro',
      sequentialNumber: '006',
      project: 'PROJET LOGISTIQUE',
      region: 'Anosy',
      projectCode: 'PRJ-2026-006',
      grantCode: 'GNT-2026-L01',
      activityCode: 'ACT-006',
      costCenter: 'CC-LOG-001',
      title: '[REJETÉ] Drone de surveillance — hors budget',
      description: 'Drone pour surveillance des zones enclavées',
      marketType: 'Gré à gré',
      operationType: OperationType.OPERATION,
      requestedDeliveryDate: new Date('2026-05-01'),
      priority: 'BASSE',
      justification:
        'Amélioration de la couverture terrain dans les zones isolées',
      deliveryAddress: 'Bureau OSDRM Taolagnaro',
      status: PurchaseStatus.REJECTED,
      currentStep: PurchaseStep.DA,
      observations:
        'CFO: Dépense non prioritaire, hors allocation budgétaire 2026. Resoumission possible en 2027.',
      closedAt: new Date('2026-02-20'),
      creatorId: demandeur2.id,
      items: {
        create: [
          {
            designation: 'Drone DJI Matrice 300 RTK',
            quantity: 1,
            unitPrice: 35000000,
            amount: 35000000,
            unit: 'unité',
          },
        ],
      },
    },
  });
  await prisma.validationWorkflow.create({
    data: {
      purchaseId: p6.id,
      step: PurchaseStep.DA,
      currentStep: 2,
      isComplete: false,
      validators: {
        create: [
          {
            role: ValidatorRole.DEMANDEUR,
            order: 0,
            userId: demandeur2.id,
            name: demandeur2.name,
            email: demandeur2.email,
            isValidated: true,
            validatedAt: new Date('2026-02-15'),
            decision: 'APPROVED',
          },
          {
            role: ValidatorRole.OM,
            order: 1,
            userId: om.id,
            name: om.name,
            email: om.email,
            isValidated: true,
            validatedAt: new Date('2026-02-16'),
            decision: 'APPROVED',
            comment: 'Sous réserve approbation CFO',
          },
          {
            role: ValidatorRole.CFO,
            order: 2,
            userId: cfo.id,
            name: cfo.name,
            email: cfo.email,
            isValidated: false,
            decision: 'REJECTED',
            comment: 'Hors budget 2026, non prioritaire',
          },
          {
            role: ValidatorRole.CEO,
            order: 3,
            userId: ceo.id,
            name: ceo.name,
            email: ceo.email,
            isValidated: false,
          },
        ],
      },
    },
  });

  // ══════════════════════════════════════════════════════════════
  // DA-007 — AWAITING_DOCUMENTS / QR | 1 devis uploadé (upload en cours)
  // ══════════════════════════════════════════════════════════════
  const p7 = await prisma.purchase.create({
    data: {
      reference: 'DA-2026-007',
      year: 2026,
      site: 'Toamasina',
      sequentialNumber: '007',
      project: 'PROJET EDUCATION',
      region: 'Atsinanana',
      projectCode: 'PRJ-2026-002',
      grantCode: 'GNT-2026-E01',
      activityCode: 'ACT-007',
      costCenter: 'CC-EDU-001',
      title:
        '[QR - UPLOAD EN COURS] Équipements audiovisuels — 1/3 devis uploadé',
      description: 'Équipements audiovisuels pour salles de formation',
      marketType: 'Consultation',
      operationType: OperationType.OPERATION,
      requestedDeliveryDate: new Date('2026-05-15'),
      priority: 'MOYENNE',
      justification: 'Équipement des nouvelles salles de formation régionale',
      deliveryAddress: 'Centre de Formation, Toamasina',
      status: PurchaseStatus.AWAITING_DOCUMENTS,
      currentStep: PurchaseStep.QR,
      creatorId: demandeur2.id,
      items: {
        create: [
          {
            designation: 'Écran LED 65 pouces',
            quantity: 5,
            unitPrice: 3500000,
            amount: 17500000,
            unit: 'unité',
          },
          {
            designation: 'Système audio Bluetooth',
            quantity: 5,
            unitPrice: 1200000,
            amount: 6000000,
            unit: 'unité',
          },
        ],
      },
    },
  });
  await prisma.validationWorkflow.create({
    data: {
      purchaseId: p7.id,
      step: PurchaseStep.DA,
      currentStep: 4,
      isComplete: true,
      validators: {
        create: daApprovedValidators(
          { demandeur: demandeur2, om, cfo, ceo },
          new Date('2026-02-01'),
        ),
      },
    },
  });
  await prisma.attachment.create({
    data: {
      purchaseId: p7.id,
      type: AttachmentType.QUOTE,
      fileName: 'devis_av_globaltrade.pdf',
      fileUrl: 's3://osdrm-bucket/qr/p7_devis_1.pdf',
      fileSize: 320000,
      mimeType: 'application/pdf',
      description: 'Devis Global Trade SARL (1/3)',
      uploadedBy: acheteur.name,
      receivedAt: new Date('2026-03-01'),
    },
  });

  // ══════════════════════════════════════════════════════════════
  // DA-008 — PENDING_APPROVAL / QR | 3 devis soumis, en attente CFO
  // ══════════════════════════════════════════════════════════════
  const p8 = await prisma.purchase.create({
    data: {
      reference: 'DA-2026-008',
      year: 2026,
      site: 'Mahajanga',
      sequentialNumber: '008',
      project: 'PROJET SANTE',
      region: 'Boeny',
      projectCode: 'PRJ-2026-004',
      grantCode: 'GNT-2026-S01',
      activityCode: 'ACT-008',
      costCenter: 'CC-SANTE-001',
      title:
        '[QR PENDING] Médicaments essentiels — 3 devis soumis, en attente CFO',
      description: 'Stock de médicaments essentiels pour le district sanitaire',
      marketType: "Appel d'offres",
      operationType: OperationType.PROGRAMME,
      requestedDeliveryDate: new Date('2026-05-20'),
      priority: 'HAUTE',
      justification:
        'Renouvellement stock médicaments essentiels district Mahajanga',
      deliveryAddress: 'District Sanitaire Mahajanga',
      status: PurchaseStatus.PENDING_APPROVAL,
      currentStep: PurchaseStep.QR,
      creatorId: demandeur1.id,
      items: {
        create: [
          {
            designation: 'Paracétamol 500mg (boîte 1000)',
            quantity: 100,
            unitPrice: 45000,
            amount: 4500000,
            unit: 'boîte',
          },
          {
            designation: 'Amoxicilline 250mg (boîte 500)',
            quantity: 80,
            unitPrice: 65000,
            amount: 5200000,
            unit: 'boîte',
          },
          {
            designation: 'Sérum glucosé 500ml',
            quantity: 200,
            unitPrice: 12000,
            amount: 2400000,
            unit: 'flacon',
          },
        ],
      },
    },
  });
  await prisma.validationWorkflow.create({
    data: {
      purchaseId: p8.id,
      step: PurchaseStep.DA,
      currentStep: 4,
      isComplete: true,
      validators: {
        create: daApprovedValidators(
          { demandeur: demandeur1, dp, cfo, ceo },
          new Date('2026-02-05'),
        ),
      },
    },
  });
  await prisma.validationWorkflow.create({
    data: {
      purchaseId: p8.id,
      step: PurchaseStep.QR,
      currentStep: 1,
      isComplete: false,
      validators: {
        create: [
          {
            role: ValidatorRole.DEMANDEUR,
            order: 0,
            userId: acheteur.id,
            name: acheteur.name,
            email: acheteur.email,
            isValidated: true,
            validatedAt: new Date('2026-03-01'),
            decision: 'APPROVED',
            comment: '3 devis uploadés et conformes',
          },
          {
            role: ValidatorRole.CFO,
            order: 1,
            userId: cfo.id,
            name: cfo.name,
            email: cfo.email,
            isValidated: false,
          },
        ],
      },
    },
  });
  await prisma.attachment.createMany({
    data: [
      {
        purchaseId: p8.id,
        type: AttachmentType.QUOTE,
        fileName: 'devis_med_medsupply.pdf',
        fileUrl: 's3://osdrm-bucket/qr/p8_devis_1.pdf',
        fileSize: 280000,
        mimeType: 'application/pdf',
        description: 'Devis MedSupply Madagascar',
        uploadedBy: acheteur.name,
        receivedAt: new Date('2026-02-25'),
      },
      {
        purchaseId: p8.id,
        type: AttachmentType.QUOTE,
        fileName: 'devis_med_pharma.pdf',
        fileUrl: 's3://osdrm-bucket/qr/p8_devis_2.pdf',
        fileSize: 310000,
        mimeType: 'application/pdf',
        description: 'Devis PharmaMada SARL',
        uploadedBy: acheteur.name,
        receivedAt: new Date('2026-02-26'),
      },
      {
        purchaseId: p8.id,
        type: AttachmentType.QUOTE,
        fileName: 'devis_med_healthcare.pdf',
        fileUrl: 's3://osdrm-bucket/qr/p8_devis_3.pdf',
        fileSize: 295000,
        mimeType: 'application/pdf',
        description: 'Devis HealthCare Madagascar',
        uploadedBy: acheteur.name,
        receivedAt: new Date('2026-02-27'),
      },
    ],
  });

  // ══════════════════════════════════════════════════════════════
  // DA-009 — IN_DEROGATION / QR | Fournisseur unique, dérogation PENDING
  // ══════════════════════════════════════════════════════════════
  const p9 = await prisma.purchase.create({
    data: {
      reference: 'DA-2026-009',
      year: 2026,
      site: 'Fianarantsoa',
      sequentialNumber: '009',
      project: 'PROJET AGRICULTURE',
      region: 'Haute Matsiatra',
      projectCode: 'PRJ-2026-003',
      grantCode: 'GNT-2026-A01',
      activityCode: 'ACT-009',
      costCenter: 'CC-AGRI-001',
      title:
        '[IN DEROGATION] Motoculteurs — fournisseur unique, dérogation en attente',
      description:
        'Matériel agricole pour coopératives rurales de la Haute Matsiatra',
      marketType: 'Gré à gré',
      operationType: OperationType.PROGRAMME,
      requestedDeliveryDate: new Date('2026-04-01'),
      priority: 'HAUTE',
      justification:
        'Saison de plantation imminente, fournisseur certifié unique dans la région',
      deliveryAddress: 'Coopérative FANOME, Fianarantsoa',
      status: PurchaseStatus.IN_DEROGATION,
      currentStep: PurchaseStep.QR,
      creatorId: demandeur1.id,
      items: {
        create: [
          {
            designation: 'Motoculteur diesel 8CV',
            quantity: 3,
            unitPrice: 5000000,
            amount: 15000000,
            unit: 'unité',
            specifications: 'Diesel, avec charrue réversible',
          },
          {
            designation: 'Charrue réversible',
            quantity: 3,
            unitPrice: 1500000,
            amount: 4500000,
            unit: 'unité',
          },
        ],
      },
    },
  });
  await prisma.validationWorkflow.create({
    data: {
      purchaseId: p9.id,
      step: PurchaseStep.DA,
      currentStep: 4,
      isComplete: true,
      validators: {
        create: daApprovedValidators(
          { demandeur: demandeur1, dp, cfo, ceo },
          new Date('2026-01-20'),
        ),
      },
    },
  });
  await prisma.attachment.create({
    data: {
      purchaseId: p9.id,
      type: AttachmentType.QUOTE,
      fileName: 'devis_moto_agrotech.pdf',
      fileUrl: 's3://osdrm-bucket/qr/p9_devis_1.pdf',
      fileSize: 195000,
      mimeType: 'application/pdf',
      description: 'Seul devis disponible — AgroTech Mada (certifié unique)',
      uploadedBy: acheteur.name,
    },
  });
  await prisma.derogation.create({
    data: {
      purchaseId: p9.id,
      reason:
        'Nombre de devis insuffisant — fournisseur certifié unique dans la région',
      justification:
        "La région Haute Matsiatra ne dispose que d'un seul fournisseur certifié pour ce type de matériel agricole lourd. La saison de plantation ne permet pas d'attendre des devis supplémentaires de fournisseurs hors région.",
      status: DerogationStatus.PENDING,
    },
  });

  // ══════════════════════════════════════════════════════════════
  // DA-010 — PUBLISHED / PV | Prêt pour que l'ACHETEUR remplisse le PV
  // ══════════════════════════════════════════════════════════════
  const p10 = await prisma.purchase.create({
    data: {
      reference: 'DA-2026-010',
      year: 2026,
      site: 'Antananarivo',
      sequentialNumber: '010',
      project: 'PROJET EDUCATION',
      region: 'Analamanga',
      projectCode: 'PRJ-2026-002',
      grantCode: 'GNT-2026-E01',
      activityCode: 'ACT-010',
      costCenter: 'CC-EDU-001',
      title:
        '[PV À REMPLIR ✏️] Mobilier scolaire — prêt pour évaluation fournisseurs',
      description:
        'Tables et chaises pour 10 salles de classe, 3 devis reçus et validés',
      marketType: 'Consultation',
      operationType: OperationType.PROGRAMME,
      requestedDeliveryDate: new Date('2026-06-01'),
      priority: 'MOYENNE',
      justification:
        'Remplacement du mobilier vétuste dans les écoles du projet',
      deliveryAddress: 'EPP Analamanga Centre',
      status: PurchaseStatus.PUBLISHED,
      currentStep: PurchaseStep.PV,
      creatorId: demandeur1.id,
      items: {
        create: [
          {
            designation: 'Table double élève',
            quantity: 100,
            unitPrice: 85000,
            amount: 8500000,
            unit: 'unité',
            specifications: 'Bois traité, 120x60cm',
          },
          {
            designation: 'Chaise élève',
            quantity: 200,
            unitPrice: 35000,
            amount: 7000000,
            unit: 'unité',
            specifications: 'Bois traité, hauteur 40cm',
          },
          {
            designation: 'Bureau enseignant',
            quantity: 10,
            unitPrice: 150000,
            amount: 1500000,
            unit: 'unité',
            specifications: 'Avec tiroir verrouillable',
          },
        ],
      },
    },
  });
  await prisma.validationWorkflow.create({
    data: {
      purchaseId: p10.id,
      step: PurchaseStep.DA,
      currentStep: 4,
      isComplete: true,
      validators: {
        create: daApprovedValidators(
          { demandeur: demandeur1, dp, cfo, ceo },
          new Date('2026-02-10'),
        ),
      },
    },
  });
  await prisma.validationWorkflow.create({
    data: {
      purchaseId: p10.id,
      step: PurchaseStep.QR,
      currentStep: 2,
      isComplete: true,
      validators: {
        create: [
          {
            role: ValidatorRole.DEMANDEUR,
            order: 0,
            userId: acheteur.id,
            name: acheteur.name,
            email: acheteur.email,
            isValidated: true,
            validatedAt: new Date('2026-03-05'),
            decision: 'APPROVED',
            comment: '3 devis conformes uploadés',
          },
          {
            role: ValidatorRole.CFO,
            order: 1,
            userId: cfo.id,
            name: cfo.name,
            email: cfo.email,
            isValidated: true,
            validatedAt: new Date('2026-03-06'),
            decision: 'APPROVED',
            comment: 'Validation QR accordée',
          },
        ],
      },
    },
  });
  await prisma.attachment.createMany({
    data: [
      {
        purchaseId: p10.id,
        type: AttachmentType.QUOTE,
        fileName: 'devis_mob_boismada.pdf',
        fileUrl: 's3://osdrm-bucket/qr/p10_devis_1.pdf',
        fileSize: 250000,
        mimeType: 'application/pdf',
        description: 'Devis BoisMada Menuiserie',
        uploadedBy: acheteur.name,
      },
      {
        purchaseId: p10.id,
        type: AttachmentType.QUOTE,
        fileName: 'devis_mob_mobischool.pdf',
        fileUrl: 's3://osdrm-bucket/qr/p10_devis_2.pdf',
        fileSize: 270000,
        mimeType: 'application/pdf',
        description: 'Devis MobiSchool SARL',
        uploadedBy: acheteur.name,
      },
      {
        purchaseId: p10.id,
        type: AttachmentType.QUOTE,
        fileName: 'devis_mob_menuiserie.pdf',
        fileUrl: 's3://osdrm-bucket/qr/p10_devis_3.pdf',
        fileSize: 240000,
        mimeType: 'application/pdf',
        description: 'Devis Menuiserie Nationale',
        uploadedBy: acheteur.name,
      },
    ],
  });

  // ══════════════════════════════════════════════════════════════
  // DA-011 — PENDING_APPROVAL / PV | PV soumis, en attente de validation
  // ══════════════════════════════════════════════════════════════
  const p11 = await prisma.purchase.create({
    data: {
      reference: 'DA-2026-011',
      year: 2026,
      site: 'Antsirabe',
      sequentialNumber: '011',
      project: 'PROJET SANTE',
      region: 'Vakinankaratra',
      projectCode: 'PRJ-2026-004',
      grantCode: 'GNT-2026-S01',
      activityCode: 'ACT-011',
      costCenter: 'CC-SANTE-001',
      title:
        '[PV SOUMIS] Équipements chirurgicaux — PV en attente de validation',
      description:
        'Équipements chirurgicaux pour le bloc opératoire CHD Antsirabe',
      marketType: "Appel d'offres",
      operationType: OperationType.OPERATION,
      requestedDeliveryDate: new Date('2026-06-15'),
      priority: 'HAUTE',
      justification: 'Équipement du nouveau bloc opératoire CHD Antsirabe',
      deliveryAddress: 'CHD Antsirabe',
      status: PurchaseStatus.PENDING_APPROVAL,
      currentStep: PurchaseStep.PV,
      creatorId: demandeur2.id,
      items: {
        create: [
          {
            designation: 'Bistouri électrique monopolaire/bipolaire',
            quantity: 2,
            unitPrice: 8500000,
            amount: 17000000,
            unit: 'unité',
            specifications: '300W, certifié CE',
          },
          {
            designation: 'Table opératoire électrique',
            quantity: 1,
            unitPrice: 25000000,
            amount: 25000000,
            unit: 'unité',
            specifications: 'Toutes positions, radiotransparente',
          },
          {
            designation: 'Scialytique LED double dôme',
            quantity: 2,
            unitPrice: 12000000,
            amount: 24000000,
            unit: 'unité',
            specifications: '120 000 lux',
          },
        ],
      },
    },
  });
  await prisma.validationWorkflow.create({
    data: {
      purchaseId: p11.id,
      step: PurchaseStep.DA,
      currentStep: 4,
      isComplete: true,
      validators: {
        create: daApprovedValidators(
          { demandeur: demandeur2, om, cfo, ceo },
          new Date('2026-02-15'),
        ),
      },
    },
  });
  await prisma.validationWorkflow.create({
    data: {
      purchaseId: p11.id,
      step: PurchaseStep.QR,
      currentStep: 2,
      isComplete: true,
      validators: {
        create: [
          {
            role: ValidatorRole.DEMANDEUR,
            order: 0,
            userId: acheteur.id,
            name: acheteur.name,
            email: acheteur.email,
            isValidated: true,
            validatedAt: new Date('2026-03-10'),
            decision: 'APPROVED',
            comment: '3 devis soumis',
          },
          {
            role: ValidatorRole.CFO,
            order: 1,
            userId: cfo.id,
            name: cfo.name,
            email: cfo.email,
            isValidated: true,
            validatedAt: new Date('2026-03-11'),
            decision: 'APPROVED',
            comment: 'Devis conformes',
          },
        ],
      },
    },
  });
  await prisma.pV.create({
    data: {
      purchaseId: p11.id,
      evaluateur: acheteur.name,
      dateEvaluation: new Date('2026-03-15'),
      natureObjet:
        'Équipements chirurgicaux pour bloc opératoire CHD Antsirabe',
      decisionFinale:
        'Retenir MedSupply Madagascar (rang 1) — offre financièrement compétitive à 63 500 000 Ar, conformité technique totale et SAV inclus 2 ans. SurgTech Madagascar classé 2ème — délai non conforme et SAV absent.',
      status: PVStatus.SUBMITTED,
      suppliers: {
        create: [
          {
            supplierId: sup2.id,
            order: 1,
            name: sup2.name,
            rang: 1,
            reponseDansDelai: 'Oui',
            annexe1: 'Oui',
            devisSpecifications: 'Oui',
            regulariteFiscale: 'Oui',
            copiecin: 'Oui',
            conformiteSpecs: 'Oui',
            distanceBureaux: 'Oui',
            delaiLivraison: 'Oui',
            sav: 'Oui',
            disponibiliteArticles: 'Oui',
            qualiteArticles: 'Oui',
            experienceAnterieure: 'Oui',
            producteurOuSousTraitant: 'Partiel',
            echantillonBat: 'Oui',
            validiteOffre: 'Oui',
            modePaiement: 'Oui',
            delaiPaiement: 'Partiel',
            offreFinanciere: 63500000,
            items: {
              create: [
                {
                  designation: 'Bistouri électrique',
                  quantity: 2,
                  unitPrice: 8500000,
                  amount: 17000000,
                  disponibilite: 'Oui',
                },
                {
                  designation: 'Table opératoire',
                  quantity: 1,
                  unitPrice: 22000000,
                  amount: 22000000,
                  disponibilite: 'Oui',
                },
                {
                  designation: 'Scialytique LED',
                  quantity: 2,
                  unitPrice: 12250000,
                  amount: 24500000,
                  disponibilite: 'Oui',
                },
              ],
            },
          },
          {
            order: 2,
            name: 'SurgTech Madagascar',
            rang: 2,
            reponseDansDelai: 'Oui',
            annexe1: 'Oui',
            devisSpecifications: 'Partiel',
            regulariteFiscale: 'Oui',
            copiecin: 'Oui',
            conformiteSpecs: 'Partiel',
            distanceBureaux: 'Non',
            delaiLivraison: 'Non',
            sav: 'Non',
            disponibiliteArticles: 'Partiel',
            qualiteArticles: 'Partiel',
            experienceAnterieure: 'Non',
            producteurOuSousTraitant: 'Non',
            echantillonBat: 'Non',
            validiteOffre: 'Oui',
            modePaiement: 'Oui',
            delaiPaiement: 'Oui',
            offreFinanciere: 71000000,
            items: {
              create: [
                {
                  designation: 'Bistouri électrique',
                  quantity: 2,
                  unitPrice: 9500000,
                  amount: 19000000,
                  disponibilite: 'Oui',
                },
                {
                  designation: 'Table opératoire',
                  quantity: 1,
                  unitPrice: 28000000,
                  amount: 28000000,
                  disponibilite: 'Partiel',
                },
                {
                  designation: 'Scialytique LED',
                  quantity: 2,
                  unitPrice: 12000000,
                  amount: 24000000,
                  disponibilite: 'Oui',
                },
              ],
            },
          },
        ],
      },
    },
  });

  // ══════════════════════════════════════════════════════════════
  // DA-012 — AWAITING_DOCUMENTS / BC | PV validé, BC à uploader
  // ══════════════════════════════════════════════════════════════
  const p12 = await prisma.purchase.create({
    data: {
      reference: 'DA-2026-012',
      year: 2026,
      site: 'Antananarivo',
      sequentialNumber: '012',
      project: 'PROJET IT',
      region: 'Analamanga',
      projectCode: 'PRJ-2026-005',
      grantCode: 'GNT-2026-IT01',
      activityCode: 'ACT-012',
      costCenter: 'CC-IT-001',
      title: '[BC À UPLOADER] Serveurs informatiques — BC à émettre',
      description: 'Infrastructure serveur pour le siège OSDRM',
      marketType: "Appel d'offres",
      operationType: OperationType.OPERATION,
      requestedDeliveryDate: new Date('2026-07-01'),
      priority: 'HAUTE',
      justification:
        'Remplacement serveurs obsolètes, risque de panne critique',
      deliveryAddress: 'Siège OSDRM, Antananarivo',
      status: PurchaseStatus.AWAITING_DOCUMENTS,
      currentStep: PurchaseStep.BC,
      creatorId: demandeur1.id,
      items: {
        create: [
          {
            designation: 'Serveur Dell PowerEdge R750',
            quantity: 2,
            unitPrice: 45000000,
            amount: 90000000,
            unit: 'unité',
            specifications: '2x Xeon, 128GB RAM, 10TB SSD',
          },
          {
            designation: 'Switch réseau 48 ports manageable',
            quantity: 2,
            unitPrice: 8000000,
            amount: 16000000,
            unit: 'unité',
            specifications: '10GbE uplink',
          },
          {
            designation: 'Onduleur 10KVA',
            quantity: 1,
            unitPrice: 12000000,
            amount: 12000000,
            unit: 'unité',
          },
        ],
      },
    },
  });
  await prisma.validationWorkflow.create({
    data: {
      purchaseId: p12.id,
      step: PurchaseStep.DA,
      currentStep: 4,
      isComplete: true,
      validators: {
        create: daApprovedValidators(
          { demandeur: demandeur1, om, cfo, ceo },
          new Date('2026-02-20'),
        ),
      },
    },
  });
  await prisma.pV.create({
    data: {
      purchaseId: p12.id,
      evaluateur: acheteur.name,
      dateEvaluation: new Date('2026-03-20'),
      natureObjet: 'Infrastructure serveur siège OSDRM',
      decisionFinale:
        'Retenir Global Trade SARL — offre technique la plus complète, meilleur rapport qualité/prix à 115 000 000 Ar, garantie 3 ans on-site.',
      status: PVStatus.VALIDATED,
      suppliers: {
        create: [
          {
            supplierId: sup1.id,
            order: 1,
            name: sup1.name,
            rang: 1,
            reponseDansDelai: 'Oui',
            annexe1: 'Oui',
            devisSpecifications: 'Oui',
            regulariteFiscale: 'Oui',
            copiecin: 'Oui',
            conformiteSpecs: 'Oui',
            distanceBureaux: 'Oui',
            delaiLivraison: 'Oui',
            sav: 'Oui',
            disponibiliteArticles: 'Oui',
            qualiteArticles: 'Oui',
            experienceAnterieure: 'Oui',
            producteurOuSousTraitant: 'Non',
            echantillonBat: 'N/A',
            validiteOffre: 'Oui',
            modePaiement: 'Oui',
            delaiPaiement: 'Oui',
            offreFinanciere: 115000000,
            items: {
              create: [
                {
                  designation: 'Serveur Dell PowerEdge R750',
                  quantity: 2,
                  unitPrice: 44000000,
                  amount: 88000000,
                  disponibilite: 'Oui',
                },
                {
                  designation: 'Switch réseau 48 ports',
                  quantity: 2,
                  unitPrice: 7500000,
                  amount: 15000000,
                  disponibilite: 'Oui',
                },
                {
                  designation: 'Onduleur 10KVA',
                  quantity: 1,
                  unitPrice: 12000000,
                  amount: 12000000,
                  disponibilite: 'Oui',
                },
              ],
            },
          },
        ],
      },
    },
  });

  // ══════════════════════════════════════════════════════════════
  // DA-013 — PENDING_APPROVAL / BC | BC uploadé, en attente validation
  // ══════════════════════════════════════════════════════════════
  const p13 = await prisma.purchase.create({
    data: {
      reference: 'DA-2026-013',
      year: 2026,
      site: 'Mahajanga',
      sequentialNumber: '013',
      project: 'PROJET LOGISTIQUE',
      region: 'Boeny',
      projectCode: 'PRJ-2026-006',
      grantCode: 'GNT-2026-L01',
      activityCode: 'ACT-013',
      costCenter: 'CC-LOG-001',
      title: '[BC SOUMIS] Véhicule 4x4 — BC en attente de validation',
      description:
        'Véhicule tout-terrain pour les missions terrain région Boeny',
      marketType: "Appel d'offres",
      operationType: OperationType.OPERATION,
      requestedDeliveryDate: new Date('2026-07-15'),
      priority: 'HAUTE',
      justification:
        'Véhicule de mission indispensable pour les zones rurales enclavées',
      deliveryAddress: 'Bureau OSDRM Mahajanga',
      status: PurchaseStatus.PENDING_APPROVAL,
      currentStep: PurchaseStep.BC,
      creatorId: demandeur2.id,
      items: {
        create: [
          {
            designation: 'Toyota Land Cruiser 4x4 (neuf)',
            quantity: 1,
            unitPrice: 120000000,
            amount: 120000000,
            unit: 'unité',
            specifications: 'Diesel, boîte auto, climatisé, GPS intégré',
          },
        ],
      },
    },
  });
  await prisma.validationWorkflow.create({
    data: {
      purchaseId: p13.id,
      step: PurchaseStep.DA,
      currentStep: 4,
      isComplete: true,
      validators: {
        create: daApprovedValidators(
          { demandeur: demandeur2, om, cfo, ceo },
          new Date('2026-02-25'),
        ),
      },
    },
  });
  await prisma.attachment.create({
    data: {
      purchaseId: p13.id,
      type: AttachmentType.PURCHASE_ORDER,
      fileName: 'BC-2026-013-Toyota.pdf',
      fileUrl: 's3://osdrm-bucket/bc/p13_bc.pdf',
      fileSize: 450000,
      mimeType: 'application/pdf',
      description: 'Bon de Commande — Toyota Land Cruiser',
      uploadedBy: acheteur.name,
    },
  });

  // ══════════════════════════════════════════════════════════════
  // DA-014 — AWAITING_DOCUMENTS / BR | BC validé, livraison faite, BR à signer
  // ══════════════════════════════════════════════════════════════
  const p14 = await prisma.purchase.create({
    data: {
      reference: 'DA-2026-014',
      year: 2026,
      site: 'Fianarantsoa',
      sequentialNumber: '014',
      project: 'PROJET AGRICULTURE',
      region: 'Haute Matsiatra',
      projectCode: 'PRJ-2026-003',
      grantCode: 'GNT-2026-A01',
      activityCode: 'ACT-014',
      costCenter: 'CC-AGRI-001',
      title:
        '[BR À UPLOADER] Engrais et intrants — livraison effectuée, BR à uploader',
      description: 'Engrais et intrants agricoles pour la saison 2026',
      marketType: 'Consultation',
      operationType: OperationType.PROGRAMME,
      requestedDeliveryDate: new Date('2026-04-15'),
      priority: 'HAUTE',
      justification: 'Distribution aux agriculteurs avant la saison des pluies',
      deliveryAddress: 'Direction Régionale Agriculture, Fianarantsoa',
      status: PurchaseStatus.AWAITING_DOCUMENTS,
      currentStep: PurchaseStep.BR,
      receivedAt: new Date('2026-04-10'),
      creatorId: demandeur1.id,
      items: {
        create: [
          {
            designation: 'Engrais NPK 15-15-15',
            quantity: 5000,
            unitPrice: 5000,
            amount: 25000000,
            unit: 'kg',
          },
          {
            designation: 'Urée 46%',
            quantity: 2000,
            unitPrice: 6500,
            amount: 13000000,
            unit: 'kg',
          },
        ],
      },
    },
  });
  await prisma.validationWorkflow.create({
    data: {
      purchaseId: p14.id,
      step: PurchaseStep.DA,
      currentStep: 4,
      isComplete: true,
      validators: {
        create: daApprovedValidators(
          { demandeur: demandeur1, dp, cfo, ceo },
          new Date('2026-01-10'),
        ),
      },
    },
  });
  await prisma.attachment.create({
    data: {
      purchaseId: p14.id,
      type: AttachmentType.PURCHASE_ORDER,
      fileName: 'BC-2026-014.pdf',
      fileUrl: 's3://osdrm-bucket/bc/p14_bc.pdf',
      fileSize: 210000,
      mimeType: 'application/pdf',
      description: 'Bon de Commande émis et validé',
      uploadedBy: acheteur.name,
    },
  });

  // ══════════════════════════════════════════════════════════════
  // DA-015 — AWAITING_DOCUMENTS / INVOICE | BR signé, en attente facture
  // ══════════════════════════════════════════════════════════════
  const p15 = await prisma.purchase.create({
    data: {
      reference: 'DA-2026-015',
      year: 2026,
      site: 'Toamasina',
      sequentialNumber: '015',
      project: 'PROJET SANTE',
      region: 'Atsinanana',
      projectCode: 'PRJ-2026-004',
      grantCode: 'GNT-2026-S01',
      activityCode: 'ACT-015',
      costCenter: 'CC-SANTE-001',
      title:
        '[INVOICE À UPLOADER] Consommables labo — BR signé, facture attendue',
      description: "Consommables pour le laboratoire d'analyses CHD Toamasina",
      marketType: 'Consultation',
      operationType: OperationType.OPERATION,
      requestedDeliveryDate: new Date('2026-05-01'),
      priority: 'MOYENNE',
      justification: 'Renouvellement consommables laboratoire',
      deliveryAddress: 'Laboratoire CHD Toamasina',
      status: PurchaseStatus.AWAITING_DOCUMENTS,
      currentStep: PurchaseStep.INVOICE,
      receivedAt: new Date('2026-04-28'),
      creatorId: demandeur2.id,
      items: {
        create: [
          {
            designation: 'Réactifs hématologie',
            quantity: 50,
            unitPrice: 180000,
            amount: 9000000,
            unit: 'kit',
          },
          {
            designation: 'Tubes prélèvement EDTA',
            quantity: 5000,
            unitPrice: 1200,
            amount: 6000000,
            unit: 'pièce',
          },
        ],
      },
    },
  });
  await prisma.attachment.createMany({
    data: [
      {
        purchaseId: p15.id,
        type: AttachmentType.PURCHASE_ORDER,
        fileName: 'BC-2026-015.pdf',
        fileUrl: 's3://osdrm-bucket/bc/p15_bc.pdf',
        fileSize: 200000,
        mimeType: 'application/pdf',
        description: 'Bon de Commande',
        uploadedBy: acheteur.name,
      },
      {
        purchaseId: p15.id,
        type: AttachmentType.DELIVERY_NOTE,
        fileName: 'BR-2026-015.pdf',
        fileUrl: 's3://osdrm-bucket/br/p15_br.pdf',
        fileSize: 180000,
        mimeType: 'application/pdf',
        description: 'Bon de Réception signé',
        uploadedBy: demandeur2.name,
      },
    ],
  });

  // ══════════════════════════════════════════════════════════════
  // DA-016 — AWAITING_DOCUMENTS / DAP | Facture reçue, DAP à établir
  // ══════════════════════════════════════════════════════════════
  const p16 = await prisma.purchase.create({
    data: {
      reference: 'DA-2026-016',
      year: 2026,
      site: 'Antananarivo',
      sequentialNumber: '016',
      project: 'PROJET HEALTH',
      region: 'Analamanga',
      projectCode: 'PRJ-2026-001',
      grantCode: 'GNT-2026-H01',
      activityCode: 'ACT-016',
      costCenter: 'CC-HEALTH-001',
      title:
        '[DAP EN COURS] Kits premiers secours — facture reçue, DAP à établir',
      description: 'Kits de premiers secours pour équipes terrain',
      marketType: 'Consultation',
      operationType: OperationType.PROGRAMME,
      requestedDeliveryDate: new Date('2026-03-15'),
      priority: 'HAUTE',
      justification: 'Dotation obligatoire EPI pour les missions terrain',
      deliveryAddress: 'Siège OSDRM, Antananarivo',
      status: PurchaseStatus.AWAITING_DOCUMENTS,
      currentStep: PurchaseStep.DAP,
      receivedAt: new Date('2026-03-10'),
      creatorId: demandeur1.id,
      items: {
        create: [
          {
            designation: 'Kit premiers secours complet',
            quantity: 30,
            unitPrice: 95000,
            amount: 2850000,
            unit: 'kit',
          },
          {
            designation: 'Trousse individuelle secours',
            quantity: 100,
            unitPrice: 25000,
            amount: 2500000,
            unit: 'pièce',
          },
        ],
      },
    },
  });
  await prisma.attachment.createMany({
    data: [
      {
        purchaseId: p16.id,
        type: AttachmentType.PURCHASE_ORDER,
        fileName: 'BC-2026-016.pdf',
        fileUrl: 's3://osdrm-bucket/bc/p16_bc.pdf',
        fileSize: 200000,
        mimeType: 'application/pdf',
        uploadedBy: acheteur.name,
      },
      {
        purchaseId: p16.id,
        type: AttachmentType.DELIVERY_NOTE,
        fileName: 'BR-2026-016.pdf',
        fileUrl: 's3://osdrm-bucket/br/p16_br.pdf',
        fileSize: 180000,
        mimeType: 'application/pdf',
        uploadedBy: demandeur1.name,
      },
      {
        purchaseId: p16.id,
        type: AttachmentType.INVOICE,
        fileName: 'FACTURE-2026-016.pdf',
        fileUrl: 's3://osdrm-bucket/invoices/p16_inv.pdf',
        fileSize: 220000,
        mimeType: 'application/pdf',
        description: 'Facture fournisseur reçue',
        uploadedBy: acheteur.name,
      },
    ],
  });

  // ══════════════════════════════════════════════════════════════
  // DA-017 — AWAITING_DOCUMENTS / PROOF_OF_PAYMENT | DAP établi, virement en cours
  // ══════════════════════════════════════════════════════════════
  const p17 = await prisma.purchase.create({
    data: {
      reference: 'DA-2026-017',
      year: 2026,
      site: 'Antananarivo',
      sequentialNumber: '017',
      project: 'PROJET IT',
      region: 'Analamanga',
      projectCode: 'PRJ-2026-005',
      grantCode: 'GNT-2026-IT01',
      activityCode: 'ACT-017',
      costCenter: 'CC-IT-001',
      title:
        '[PROOF OF PAYMENT ATTENDU] Licences logiciels — DAP établi, virement en cours',
      description: 'Licences annuelles logiciels de gestion pour le siège',
      marketType: 'Gré à gré',
      operationType: OperationType.OPERATION,
      requestedDeliveryDate: new Date('2026-02-28'),
      priority: 'HAUTE',
      justification:
        'Renouvellement licences logiciels de gestion financière et RH',
      deliveryAddress: 'Siège OSDRM, Antananarivo',
      status: PurchaseStatus.AWAITING_DOCUMENTS,
      currentStep: PurchaseStep.PROOF_OF_PAYMENT,
      receivedAt: new Date('2026-02-20'),
      creatorId: demandeur1.id,
      items: {
        create: [
          {
            designation: 'Licence Sage 100 Comptabilité (1 an)',
            quantity: 1,
            unitPrice: 8500000,
            amount: 8500000,
            unit: 'licence',
          },
          {
            designation: 'Licence Microsoft 365 Business (10 users)',
            quantity: 1,
            unitPrice: 3200000,
            amount: 3200000,
            unit: 'licence',
          },
        ],
      },
    },
  });
  await prisma.attachment.createMany({
    data: [
      {
        purchaseId: p17.id,
        type: AttachmentType.PURCHASE_ORDER,
        fileName: 'BC-2026-017.pdf',
        fileUrl: 's3://osdrm-bucket/bc/p17_bc.pdf',
        fileSize: 195000,
        mimeType: 'application/pdf',
        uploadedBy: acheteur.name,
      },
      {
        purchaseId: p17.id,
        type: AttachmentType.DELIVERY_NOTE,
        fileName: 'BR-2026-017.pdf',
        fileUrl: 's3://osdrm-bucket/br/p17_br.pdf',
        fileSize: 175000,
        mimeType: 'application/pdf',
        uploadedBy: demandeur1.name,
      },
      {
        purchaseId: p17.id,
        type: AttachmentType.INVOICE,
        fileName: 'FACTURE-2026-017.pdf',
        fileUrl: 's3://osdrm-bucket/invoices/p17_inv.pdf',
        fileSize: 210000,
        mimeType: 'application/pdf',
        uploadedBy: acheteur.name,
      },
      {
        purchaseId: p17.id,
        type: AttachmentType.OTHER,
        fileName: 'DAP-2026-017.pdf',
        fileUrl: 's3://osdrm-bucket/dap/p17_dap.pdf',
        fileSize: 185000,
        mimeType: 'application/pdf',
        description: 'Demande de Paiement établie',
        uploadedBy: cfo.name,
      },
    ],
  });

  // ══════════════════════════════════════════════════════════════
  // DA-018 — VALIDATED / DONE | Dossier entièrement clôturé ✓
  // ══════════════════════════════════════════════════════════════
  const p18 = await prisma.purchase.create({
    data: {
      reference: 'DA-2026-018',
      year: 2026,
      site: 'Antananarivo',
      sequentialNumber: '018',
      project: 'PROJET HEALTH',
      region: 'Analamanga',
      projectCode: 'PRJ-2026-001',
      grantCode: 'GNT-2026-H01',
      activityCode: 'ACT-018',
      costCenter: 'CC-HEALTH-001',
      title:
        '[DONE ✓] Équipements de protection individuelle — dossier clôturé',
      description: 'EPI complets pour équipes terrain (casques, gilets, gants)',
      marketType: 'Consultation',
      operationType: OperationType.PROGRAMME,
      requestedDeliveryDate: new Date('2026-02-15'),
      priority: 'HAUTE',
      justification: 'Dotation EPI réglementaire pour missions terrain',
      deliveryAddress: 'Siège OSDRM, Antananarivo',
      status: PurchaseStatus.VALIDATED,
      currentStep: PurchaseStep.DONE,
      validatedAt: new Date('2026-03-01'),
      closedAt: new Date('2026-03-01'),
      receivedAt: new Date('2026-02-14'),
      creatorId: demandeur1.id,
      items: {
        create: [
          {
            designation: 'Casque de protection',
            quantity: 50,
            unitPrice: 45000,
            amount: 2250000,
            unit: 'unité',
          },
          {
            designation: 'Gilet sécurité haute visibilité',
            quantity: 50,
            unitPrice: 25000,
            amount: 1250000,
            unit: 'unité',
          },
          {
            designation: 'Gants de protection',
            quantity: 100,
            unitPrice: 8000,
            amount: 800000,
            unit: 'paire',
          },
        ],
      },
    },
  });
  await prisma.attachment.createMany({
    data: [
      {
        purchaseId: p18.id,
        type: AttachmentType.QUOTE,
        fileName: 'devis_epi_A.pdf',
        fileUrl: 's3://osdrm-bucket/qr/p18_devis_1.pdf',
        fileSize: 120000,
        mimeType: 'application/pdf',
        description: 'Devis fournisseur A',
        uploadedBy: acheteur.name,
      },
      {
        purchaseId: p18.id,
        type: AttachmentType.QUOTE,
        fileName: 'devis_epi_B.pdf',
        fileUrl: 's3://osdrm-bucket/qr/p18_devis_2.pdf',
        fileSize: 130000,
        mimeType: 'application/pdf',
        description: 'Devis fournisseur B',
        uploadedBy: acheteur.name,
      },
      {
        purchaseId: p18.id,
        type: AttachmentType.QUOTE,
        fileName: 'devis_epi_C.pdf',
        fileUrl: 's3://osdrm-bucket/qr/p18_devis_3.pdf',
        fileSize: 115000,
        mimeType: 'application/pdf',
        description: 'Devis fournisseur C',
        uploadedBy: acheteur.name,
      },
      {
        purchaseId: p18.id,
        type: AttachmentType.PURCHASE_ORDER,
        fileName: 'BC-2026-018.pdf',
        fileUrl: 's3://osdrm-bucket/bc/p18_bc.pdf',
        fileSize: 200000,
        mimeType: 'application/pdf',
        uploadedBy: acheteur.name,
      },
      {
        purchaseId: p18.id,
        type: AttachmentType.DELIVERY_NOTE,
        fileName: 'BR-2026-018.pdf',
        fileUrl: 's3://osdrm-bucket/br/p18_br.pdf',
        fileSize: 180000,
        mimeType: 'application/pdf',
        uploadedBy: demandeur1.name,
      },
      {
        purchaseId: p18.id,
        type: AttachmentType.INVOICE,
        fileName: 'FACTURE-2026-018.pdf',
        fileUrl: 's3://osdrm-bucket/invoices/p18_inv.pdf',
        fileSize: 220000,
        mimeType: 'application/pdf',
        uploadedBy: acheteur.name,
      },
      {
        purchaseId: p18.id,
        type: AttachmentType.PROOF_OF_PAYMENT,
        fileName: 'PAIEMENT-2026-018.pdf',
        fileUrl: 's3://osdrm-bucket/payments/p18_pay.pdf',
        fileSize: 150000,
        mimeType: 'application/pdf',
        description: 'Preuve de paiement — virement validé',
        uploadedBy: cfo.name,
      },
    ],
  });

  // ══════════════════════════════════════════════════════════════
  // AUDIT LOGS
  // ══════════════════════════════════════════════════════════════
  console.log('📝 Création des audit logs...');
  await prisma.auditLog.createMany({
    data: [
      {
        userId: demandeur1.id,
        action: 'PURCHASE_CREATED',
        resource: 'Purchase',
        resourceId: p2.id,
        details: { reference: 'DA-2026-002' },
      },
      {
        userId: demandeur2.id,
        action: 'PURCHASE_CREATED',
        resource: 'Purchase',
        resourceId: p8.id,
        details: { reference: 'DA-2026-008' },
      },
      {
        userId: acheteur.id,
        action: 'QUOTES_UPLOADED',
        resource: 'Purchase',
        resourceId: p8.id,
        details: { count: 3, reference: 'DA-2026-008' },
      },
      {
        userId: acheteur.id,
        action: 'QR_SUBMITTED',
        resource: 'Purchase',
        resourceId: p8.id,
        details: { reference: 'DA-2026-008' },
      },
      {
        userId: acheteur.id,
        action: 'PV_SUBMITTED',
        resource: 'Purchase',
        resourceId: p11.id,
        details: { reference: 'DA-2026-011' },
      },
      {
        userId: cfo.id,
        action: 'VALIDATION_APPROVED',
        resource: 'Purchase',
        resourceId: p12.id,
        details: { step: 'QR', reference: 'DA-2026-012' },
      },
      {
        userId: acheteur.id,
        action: 'BC_UPLOADED',
        resource: 'Purchase',
        resourceId: p13.id,
        details: { reference: 'DA-2026-013' },
      },
      {
        userId: cfo.id,
        action: 'VALIDATION_REJECTED',
        resource: 'Purchase',
        resourceId: p6.id,
        details: { comment: 'Hors budget 2026', reference: 'DA-2026-006' },
      },
      {
        userId: cfo.id,
        action: 'PAYMENT_VALIDATED',
        resource: 'Purchase',
        resourceId: p18.id,
        details: { reference: 'DA-2026-018', amount: 4300000 },
      },
    ],
  });

  // ══════════════════════════════════════════════════════════════
  // RÉSUMÉ
  // ══════════════════════════════════════════════════════════════
  console.log(
    '\n════════════════════════════════════════════════════════════════════',
  );
  console.log('✅ Seeding terminé avec succès!\n');
  console.log("📊 RÉSUMÉ: 8 users | 4 fournisseurs | 18 dossiers d'achat\n");
  console.log('🗂️  COUVERTURE COMPLÈTE DU PIPELINE:\n');
  console.log(
    '  ── Étape DA ──────────────────────────────────────────────────',
  );
  console.log('  DA-001  DRAFT               Brouillon non publié');
  console.log('  DA-002  PUBLISHED           En attente validation OM');
  console.log('  DA-003  PUBLISHED           En attente validation DP (OM ✓)');
  console.log(
    '  DA-004  PENDING_APPROVAL    En attente approbation CEO (OM+CFO ✓)',
  );
  console.log('  DA-005  CHANGE_REQUESTED    Modification demandée par DP');
  console.log('  DA-006  REJECTED            Rejeté par CFO (hors budget)');
  console.log('');
  console.log(
    '  ── Étape QR ──────────────────────────────────────────────────',
  );
  console.log('  DA-007  AWAITING_DOCUMENTS  1 devis uploadé sur 3 requis');
  console.log('  DA-008  PENDING_APPROVAL    3 devis soumis, en attente CFO');
  console.log(
    '  DA-009  IN_DEROGATION       Fournisseur unique, dérogation PENDING',
  );
  console.log('');
  console.log(
    '  ── Étape PV ──────────────────────────────────────────────────',
  );
  console.log(
    '  DA-010  PUBLISHED       ✏️  Prêt pour PV → connecter acheteur@osdrm.mg',
  );
  console.log(
    '  DA-011  PENDING_APPROVAL    PV soumis, en attente de validation',
  );
  console.log('');
  console.log(
    '  ── Étape BC ──────────────────────────────────────────────────',
  );
  console.log('  DA-012  AWAITING_DOCUMENTS  PV validé, BC à uploader');
  console.log(
    '  DA-013  PENDING_APPROVAL    BC uploadé, en attente validation',
  );
  console.log('');
  console.log(
    '  ── Étape BR ──────────────────────────────────────────────────',
  );
  console.log(
    '  DA-014  AWAITING_DOCUMENTS  Livraison effectuée, BR à uploader',
  );
  console.log('');
  console.log(
    '  ── Étape INVOICE ─────────────────────────────────────────────',
  );
  console.log('  DA-015  AWAITING_DOCUMENTS  BR signé, facture à uploader');
  console.log('');
  console.log(
    '  ── Étape DAP ─────────────────────────────────────────────────',
  );
  console.log('  DA-016  AWAITING_DOCUMENTS  Facture reçue, DAP à établir');
  console.log('');
  console.log(
    '  ── Étape PROOF_OF_PAYMENT ────────────────────────────────────',
  );
  console.log('  DA-017  AWAITING_DOCUMENTS  DAP établi, virement en cours');
  console.log('');
  console.log(
    '  ── DONE ──────────────────────────────────────────────────────',
  );
  console.log('  DA-018  VALIDATED/DONE   ✓  Dossier entièrement clôturé');
  console.log('');
  console.log('👤 COMPTES (mot de passe: Password123!)');
  console.log('   acheteur@osdrm.mg    ACHETEUR  → upload devis, PV, BC');
  console.log('   demandeur1@osdrm.mg  DEMANDEUR');
  console.log('   demandeur2@osdrm.mg  DEMANDEUR');
  console.log('   om@osdrm.mg          OM        → valide DA');
  console.log('   dp@osdrm.mg          DP        → valide DA');
  console.log('   cfo@osdrm.mg         CFO       → valide DA + QR');
  console.log('   ceo@osdrm.mg         CEO       → approbation finale DA');
  console.log('   admin@osdrm.mg       ADMIN');
  console.log(
    '════════════════════════════════════════════════════════════════════\n',
  );
}

main()
  .catch((e) => {
    console.error('❌ Erreur seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
