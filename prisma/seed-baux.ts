import {
  PrismaClient,
  LgBailType,
  LgBailStatut,
  LgBailPaiementType,
} from '@prisma/client';

const today = new Date();
const daysFromNow = (n: number) => new Date(today.getTime() + n * 86_400_000);
const monthsAgo = (m: number) => {
  const d = new Date(today);
  d.setMonth(d.getMonth() - m);
  return d;
};
const monthsFromNow = (m: number) => {
  const d = new Date(today);
  d.setMonth(d.getMonth() + m);
  return d;
};
const periodeOffset = (monthOffset: number): string => {
  // Anchor to 1st of month to avoid day-overflow (e.g. Jan 31 + 1 month = Mar 3)
  const d = new Date(today.getFullYear(), today.getMonth(), 1);
  d.setMonth(d.getMonth() + monthOffset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export async function seedBaux(prisma: PrismaClient) {
  await prisma.lgBailAlertLog.deleteMany();
  await prisma.lgBailPaiement.deleteMany();
  await prisma.lgBailAvenant.deleteMany();
  await prisma.lgBailContract.deleteMany();

  const year = today.getFullYear();

  // ─── 1. Bureaux principaux Plateau — long terme, historique complet ───────
  const c1 = await prisma.lgBailContract.create({
    data: {
      reference: `BAX-${year}-0001`,
      type: LgBailType.IMMOBILIER,
      statut: LgBailStatut.ACTIF,
      bailleur: 'SCI Immo Plateau',
      preneur: 'OSDRM',
      objetBail: 'Bureaux principaux — Plateau, 4ème étage, 450 m²',
      site: 'Abidjan - Plateau',
      dateSignature: monthsAgo(24),
      dateDebut: monthsAgo(24),
      dateFin: monthsFromNow(21),
      dureeInitialeMois: 45,
      montantMensuel: '5200000.00',
      montantDepotGarantie: '15600000.00',
      conditionsParticulieres:
        'Révision annuelle selon indice ICC. Préavis de résiliation : 3 mois.',
      indexationRate: '3.50',
      indexationMois: 2,
    },
  });

  await prisma.lgBailAvenant.createMany({
    data: [
      {
        contractId: c1.id,
        numero: `INDEXATION-${year - 1}`,
        dateSignature: new Date(`${year - 1}-02-01`),
        description: `Indexation annuelle ${year - 1} — taux 3.50% appliqué. Ancien montant : 5 024 154.00, nouveau : 5 200 000.00.`,
        nouveauMontant: '5200000.00',
      },
      {
        contractId: c1.id,
        numero: 'AV-001',
        dateSignature: monthsAgo(10),
        description:
          'Extension de la surface louée au 5ème étage (+80 m²). Ajout du local technique.',
        nouveauMontant: null,
      },
    ],
  });

  await prisma.lgBailPaiement.createMany({
    data: [
      periodeOffset(-5),
      periodeOffset(-4),
      periodeOffset(-3),
      periodeOffset(-2),
      periodeOffset(-1),
      periodeOffset(0),
    ].map((periode) => ({
      contractId: c1.id,
      periode,
      montantPaye: '5200000.00',
      datePaiement: new Date(
        parseInt(periode.split('-')[0]),
        parseInt(periode.split('-')[1]) - 1,
        5,
      ),
      typePaiement: LgBailPaiementType.LOYER,
    })),
  });

  // ─── 2. Entrepôt Yopougon — expire dans 90 jours ─────────────────────────
  const c2 = await prisma.lgBailContract.create({
    data: {
      reference: `BAX-${year}-0002`,
      type: LgBailType.IMMOBILIER,
      statut: LgBailStatut.ACTIF,
      bailleur: 'Groupe Logistique CI',
      preneur: 'OSDRM',
      objetBail: 'Entrepôt logistique — Yopougon Zone industrielle, 1 200 m²',
      site: 'Abidjan - Yopougon',
      dateSignature: monthsAgo(30),
      dateDebut: monthsAgo(30),
      dateFin: daysFromNow(90),
      dureeInitialeMois: 33,
      montantMensuel: '1850000.00',
      montantDepotGarantie: '5550000.00',
      indexationRate: '2.00',
      indexationMois: 6,
    },
  });

  await prisma.lgBailAvenant.create({
    data: {
      contractId: c2.id,
      numero: 'AV-001',
      dateSignature: monthsAgo(6),
      description: 'Renouvellement anticipé de 6 mois supplémentaires.',
      nouveauMontant: null,
    },
  });

  await prisma.lgBailPaiement.createMany({
    data: [periodeOffset(-3), periodeOffset(-2), periodeOffset(-1)].map(
      (periode) => ({
        contractId: c2.id,
        periode,
        montantPaye: '1850000.00',
        datePaiement: new Date(
          parseInt(periode.split('-')[0]),
          parseInt(periode.split('-')[1]) - 1,
          3,
        ),
        typePaiement: LgBailPaiementType.LOYER,
      }),
    ),
  });

  // Dépôt de garantie initial
  await prisma.lgBailPaiement.create({
    data: {
      contractId: c2.id,
      periode: periodeOffset(-30),
      montantPaye: '5550000.00',
      datePaiement: monthsAgo(30),
      typePaiement: LgBailPaiementType.DEPOT_GARANTIE,
      notes: 'Dépôt de garantie versé à la signature du bail.',
    },
  });

  // ─── 3. Salle de réunion Cocody — expire dans 30 jours ───────────────────
  const c3 = await prisma.lgBailContract.create({
    data: {
      reference: `BAX-${year}-0003`,
      type: LgBailType.IMMOBILIER,
      statut: LgBailStatut.ACTIF,
      bailleur: 'Résidence Les Palmiers',
      preneur: 'OSDRM',
      objetBail: 'Salle de réunion et formation — Cocody Riviera, 120 m²',
      site: 'Abidjan - Cocody',
      dateSignature: monthsAgo(12),
      dateDebut: monthsAgo(12),
      dateFin: daysFromNow(30),
      dureeInitialeMois: 13,
      montantMensuel: '820000.00',
      montantDepotGarantie: '1640000.00',
      indexationRate: '0',
      indexationMois: 1,
    },
  });

  await prisma.lgBailPaiement.createMany({
    data: [periodeOffset(-2), periodeOffset(-1)].map((periode) => ({
      contractId: c3.id,
      periode,
      montantPaye: '820000.00',
      datePaiement: new Date(
        parseInt(periode.split('-')[0]),
        parseInt(periode.split('-')[1]) - 1,
        1,
      ),
      typePaiement: LgBailPaiementType.LOYER,
    })),
  });
  // Pas de paiement pour le mois courant → paiement en retard

  // ─── 4. Bureau régional San-Pédro — expire dans 7 jours ──────────────────
  const c4 = await prisma.lgBailContract.create({
    data: {
      reference: `BAX-${year}-0004`,
      type: LgBailType.IMMOBILIER,
      statut: LgBailStatut.ACTIF,
      bailleur: 'Immobilier Bas-Sassandra',
      preneur: 'OSDRM',
      objetBail: 'Bureau régional — San-Pédro, 60 m²',
      site: 'San-Pédro',
      dateSignature: monthsAgo(24),
      dateDebut: monthsAgo(24),
      dateFin: daysFromNow(7),
      dureeInitialeMois: 24,
      montantMensuel: '480000.00',
      conditionsParticulieres: 'Reconduction tacite par période de 12 mois.',
      indexationRate: '0',
      indexationMois: 1,
    },
  });

  await prisma.lgBailPaiement.createMany({
    data: [periodeOffset(-1), periodeOffset(0)].map((periode) => ({
      contractId: c4.id,
      periode,
      montantPaye: '480000.00',
      datePaiement: new Date(
        parseInt(periode.split('-')[0]),
        parseInt(periode.split('-')[1]) - 1,
        2,
      ),
      typePaiement: LgBailPaiementType.LOYER,
    })),
  });

  // ─── 5. Flotte véhicules de service — expire dans 15 jours ───────────────
  const c5 = await prisma.lgBailContract.create({
    data: {
      reference: `BAX-${year}-0005`,
      type: LgBailType.VEHICULE,
      statut: LgBailStatut.ACTIF,
      bailleur: 'Auto Lease CI',
      preneur: 'OSDRM',
      objetBail: 'Location longue durée — 3 véhicules Toyota Hilux',
      site: 'Abidjan - Plateau',
      dateSignature: monthsAgo(36),
      dateDebut: monthsAgo(36),
      dateFin: daysFromNow(15),
      dureeInitialeMois: 37,
      montantMensuel: '1350000.00',
      indexationRate: '0',
      indexationMois: 1,
      conditionsParticulieres:
        'Entretien à la charge du bailleur. Kilométrage illimité.',
    },
  });

  await prisma.lgBailPaiement.createMany({
    data: [periodeOffset(-2), periodeOffset(-1), periodeOffset(0)].map(
      (periode) => ({
        contractId: c5.id,
        periode,
        montantPaye: '1350000.00',
        datePaiement: new Date(
          parseInt(periode.split('-')[0]),
          parseInt(periode.split('-')[1]) - 1,
          4,
        ),
        typePaiement: LgBailPaiementType.LOYER,
      }),
    ),
  });

  // ─── 6. Photocopieurs & équipements — indexation active ───────────────────
  const c6 = await prisma.lgBailContract.create({
    data: {
      reference: `BAX-${year}-0006`,
      type: LgBailType.MATERIEL,
      statut: LgBailStatut.ACTIF,
      bailleur: "Ricoh Côte d'Ivoire",
      preneur: 'OSDRM',
      objetBail: 'Location matériel reprographique — 4 copieurs multifonctions',
      site: 'Abidjan - Plateau',
      dateSignature: monthsAgo(18),
      dateDebut: monthsAgo(18),
      dateFin: monthsFromNow(18),
      dureeInitialeMois: 36,
      montantMensuel: '320000.00',
      indexationRate: '3.50',
      indexationMois: today.getMonth() + 1,
      conditionsParticulieres:
        'Maintenance incluse. 20 000 copies/mois incluses, surplus facturé.',
    },
  });

  await prisma.lgBailAvenant.create({
    data: {
      contractId: c6.id,
      numero: `INDEXATION-${year - 1}`,
      dateSignature: new Date(
        `${year - 1}-${String(today.getMonth() + 1).padStart(2, '0')}-01`,
      ),
      description: `Indexation annuelle ${year - 1} — taux 3.50%. Ancien montant : 309 179.00, nouveau : 320 000.00.`,
      nouveauMontant: '320000.00',
    },
  });

  await prisma.lgBailPaiement.createMany({
    data: [
      periodeOffset(-4),
      periodeOffset(-3),
      periodeOffset(-2),
      periodeOffset(-1),
      periodeOffset(0),
    ].map((periode) => ({
      contractId: c6.id,
      periode,
      montantPaye: '320000.00',
      datePaiement: new Date(
        parseInt(periode.split('-')[0]),
        parseInt(periode.split('-')[1]) - 1,
        10,
      ),
      typePaiement: LgBailPaiementType.LOYER,
    })),
  });

  // ─── 7. Résidence DG — loyer du mois courant non payé ─────────────────────
  const c7 = await prisma.lgBailContract.create({
    data: {
      reference: `BAX-${year}-0007`,
      type: LgBailType.IMMOBILIER,
      statut: LgBailStatut.ACTIF,
      bailleur: 'SCI Résidences Prestige',
      preneur: 'OSDRM',
      objetBail: 'Logement de fonction — Directeur Général, Cocody Ambassades',
      site: 'Abidjan - Cocody',
      dateSignature: monthsAgo(18),
      dateDebut: monthsAgo(18),
      dateFin: monthsFromNow(6),
      dureeInitialeMois: 24,
      montantMensuel: '2500000.00',
      montantDepotGarantie: '5000000.00',
      indexationRate: '2.50',
      indexationMois: 3,
    },
  });

  // Paiements jusqu'au mois précédent — pas de LOYER pour le mois courant
  await prisma.lgBailPaiement.createMany({
    data: [periodeOffset(-3), periodeOffset(-2), periodeOffset(-1)].map(
      (periode) => ({
        contractId: c7.id,
        periode,
        montantPaye: '2500000.00',
        datePaiement: new Date(
          parseInt(periode.split('-')[0]),
          parseInt(periode.split('-')[1]) - 1,
          28,
        ),
        typePaiement: LgBailPaiementType.LOYER,
      }),
    ),
  });

  await prisma.lgBailPaiement.create({
    data: {
      contractId: c7.id,
      periode: periodeOffset(-18),
      montantPaye: '5000000.00',
      datePaiement: monthsAgo(18),
      typePaiement: LgBailPaiementType.DEPOT_GARANTIE,
      notes: 'Dépôt de garantie versé à la signature.',
    },
  });

  // ─── 8. Parking Plateau — AUTRE ───────────────────────────────────────────
  const c8 = await prisma.lgBailContract.create({
    data: {
      reference: `BAX-${year}-0008`,
      type: LgBailType.AUTRE,
      statut: LgBailStatut.ACTIF,
      bailleur: 'Immeuble Central Park CI',
      preneur: 'OSDRM',
      objetBail: 'Parking sécurisé — 8 places, sous-sol Immeuble Central Park',
      site: 'Abidjan - Plateau',
      dateSignature: monthsAgo(6),
      dateDebut: monthsAgo(6),
      dateFin: monthsFromNow(18),
      dureeInitialeMois: 24,
      montantMensuel: '160000.00',
      indexationRate: '0',
      indexationMois: 1,
    },
  });

  await prisma.lgBailPaiement.createMany({
    data: [periodeOffset(-1), periodeOffset(0)].map((periode) => ({
      contractId: c8.id,
      periode,
      montantPaye: '160000.00',
      datePaiement: new Date(
        parseInt(periode.split('-')[0]),
        parseInt(periode.split('-')[1]) - 1,
        5,
      ),
      typePaiement: LgBailPaiementType.LOYER,
    })),
  });

  // ─── 9. EN_NEGOCIATION — Nouvel entrepôt Abobo ────────────────────────────
  await prisma.lgBailContract.create({
    data: {
      reference: `BAX-${year}-0009`,
      type: LgBailType.IMMOBILIER,
      statut: LgBailStatut.EN_NEGOCIATION,
      bailleur: 'Logipro Abidjan',
      preneur: 'OSDRM',
      objetBail:
        'Entrepôt secondaire — Abobo, 800 m² (en cours de négociation)',
      site: 'Abidjan - Abobo',
      dateDebut: monthsFromNow(2),
      dateFin: monthsFromNow(26),
      dureeInitialeMois: 24,
      montantMensuel: '1200000.00',
      montantDepotGarantie: '2400000.00',
      indexationRate: '3.00',
      indexationMois: 4,
    },
  });

  // ─── 10. SUSPENDU — Bureau Adjamé ─────────────────────────────────────────
  const c10 = await prisma.lgBailContract.create({
    data: {
      reference: `BAX-${year}-0010`,
      type: LgBailType.IMMOBILIER,
      statut: LgBailStatut.SUSPENDU,
      bailleur: 'Famille Kouadio',
      preneur: 'OSDRM',
      objetBail: 'Bureau secondaire — Adjamé Liberté, 80 m² (suspendu)',
      site: 'Abidjan - Adjamé',
      dateSignature: monthsAgo(36),
      dateDebut: monthsAgo(36),
      dateFin: monthsFromNow(3),
      dureeInitialeMois: 39,
      montantMensuel: '350000.00',
      conditionsParticulieres:
        'Bail suspendu suite à travaux de rénovation du bâtiment.',
      indexationRate: '0',
      indexationMois: 1,
    },
  });

  await prisma.lgBailPaiement.create({
    data: {
      contractId: c10.id,
      periode: periodeOffset(-6),
      montantPaye: '350000.00',
      datePaiement: monthsAgo(6),
      typePaiement: LgBailPaiementType.LOYER,
      notes: 'Dernier loyer réglé avant suspension.',
    },
  });

  // ─── 11. ARCHIVE — Ancien bureau Zone 4 ───────────────────────────────────
  await prisma.lgBailContract.create({
    data: {
      reference: `BAX-${year}-0011`,
      type: LgBailType.IMMOBILIER,
      statut: LgBailStatut.ARCHIVE,
      bailleur: 'CI Patrimoine',
      preneur: 'OSDRM',
      objetBail: 'Ancien bureau Zone 4 — 200 m² (archivé)',
      site: 'Abidjan - Zone 4',
      dateSignature: monthsAgo(60),
      dateDebut: monthsAgo(60),
      dateFin: monthsAgo(12),
      dureeInitialeMois: 48,
      montantMensuel: '900000.00',
      conditionsParticulieres: 'Bail échu. Non renouvelé.',
      indexationRate: '0',
      indexationMois: 1,
    },
  });

  console.log(
    `Baux: 11 contrats | 6 ACTIF (dont 4 en alerte expiration) | 1 EN_NEGOCIATION | 1 SUSPENDU | 1 ARCHIVE | avenants & paiements`,
  );
}
