import { PrismaClient, LgTripStatus, LgTransportMode } from '@prisma/client';

const today = new Date();
const daysFromNow = (n: number) => new Date(today.getTime() + n * 86_400_000);
const year = today.getFullYear();

// Déplacements (DEP-) : toujours rattachés à un trajet (LgMission) ; le service
// n'autorise le rattachement qu'à des trajets CONFIRMED / IN_PROGRESS. Les
// déplacements PROCESSED d'un trajet déjà liquidé ont été créés quand il était
// IN_PROGRESS. Les relevés km ne concernent que les véhicules de service / moto.

export async function seedTrip(
  prisma: PrismaClient,
  userMap: Record<string, any>,
) {
  await prisma.lgTripComment.deleteMany();
  await prisma.lgTrip.deleteMany();

  const admin = userMap['admin'];
  const d1 = userMap['demandeur1'];
  const d2 = userMap['demandeur2'];

  const mission = (reference: string) =>
    prisma.lgMission.findUniqueOrThrow({
      where: { reference: `TRJ-${year}-${reference}` },
    });
  const [m3, m4, m5, m9, m10, m11] = await Promise.all(
    ['0003', '0004', '0005', '0009', '0010', '0011'].map(mission),
  );

  const v1 = await prisma.vehicle.findFirstOrThrow({
    where: { immatriculation: '1234 TAA 101' },
  });
  const v2 = await prisma.vehicle.findFirstOrThrow({
    where: { immatriculation: '5678 TAA 202' },
  });

  let seq = 0;
  const ref = () => `DEP-${year}-${String(++seq).padStart(4, '0')}`;

  // 1. PENDING — M9 Antsirabe (+2..+4), véhicule de service
  const trip1 = await prisma.lgTrip.create({
    data: {
      reference: ref(),
      mission: { connect: { id: m9.id } },
      status: LgTripStatus.PENDING,
      departureLocation: 'Antananarivo — Siège OSDRM',
      arrivalLocation: 'Antsirabe',
      departureDate: daysFromNow(3),
      arrivalDate: daysFromNow(3),
      purpose: 'Visite de supervision des centres de santé communautaires',
      transportMode: LgTransportMode.SERVICE_VEHICLE,
      departureKm: '12450.0',
      requestor: { connect: { id: d1.id } },
      vehicle: { connect: { id: v1.id } },
    },
  });

  // 2. PENDING — M3 Mahajanga (+3..+6), taxi
  await prisma.lgTrip.create({
    data: {
      reference: ref(),
      mission: { connect: { id: m3.id } },
      status: LgTripStatus.PENDING,
      departureLocation: 'Bureau OSDRM Analakely',
      arrivalLocation: 'Gare routière Fasan’ny Karana',
      departureDate: daysFromNow(3),
      purpose: 'Transfert vers la gare routière avant départ en formation',
      transportMode: LgTransportMode.TAXI,
      requestor: { connect: { id: d1.id } },
    },
  });

  // 3. PENDING — M10 Morondava (en cours), moto
  await prisma.lgTrip.create({
    data: {
      reference: ref(),
      mission: { connect: { id: m10.id } },
      status: LgTripStatus.PENDING,
      departureLocation: 'Morondava',
      arrivalLocation: 'Village de Bemanonga',
      departureDate: daysFromNow(1),
      purpose: 'Distribution de kits agricoles — zone enclavée',
      transportMode: LgTransportMode.MOTORCYCLE,
      departureKm: '8730.0',
      arrivalKm: '8752.5',
      distanceKm: '22.5',
      notes: 'Zone enclavée, moto recommandée par le chef de projet.',
      requestor: { connect: { id: d1.id } },
    },
  });

  // 4. PROCESSED — M11 Mahajanga (liquidé), transport en commun
  const trip4 = await prisma.lgTrip.create({
    data: {
      reference: ref(),
      mission: { connect: { id: m11.id } },
      status: LgTripStatus.PROCESSED,
      departureLocation: 'Antananarivo',
      arrivalLocation: 'Mahajanga',
      departureDate: daysFromNow(-45),
      arrivalDate: daysFromNow(-44),
      purpose: 'Atelier de planification annuelle — bureau régional Boeny',
      transportMode: LgTransportMode.PUBLIC_TRANSPORT,
      requestor: { connect: { id: d2.id } },
    },
  });
  await prisma.lgTripComment.createMany({
    data: [
      {
        tripId: trip4.id,
        authorId: admin.id,
        content:
          'Dossier examiné. Déplacement validé et enregistré dans le système.',
      },
      {
        tripId: trip4.id,
        authorId: d2.id,
        content: "Mission accomplie. Rapport transmis à l'équipe.",
      },
    ],
  });

  // 5. PROCESSED — M5 Antsiranana (liquidé), avion
  const trip5 = await prisma.lgTrip.create({
    data: {
      reference: ref(),
      mission: { connect: { id: m5.id } },
      status: LgTripStatus.PROCESSED,
      departureLocation: "Antananarivo — Aéroport d'Ivato",
      arrivalLocation: 'Antsiranana — Aéroport Arrachart',
      departureDate: daysFromNow(-20),
      arrivalDate: daysFromNow(-20),
      purpose: 'Audit interne programme WASH — vol aller',
      transportMode: LgTransportMode.PLANE,
      notes: 'Vol Tsaradia, billet pris par le service logistique.',
      requestor: { connect: { id: d1.id } },
    },
  });
  await prisma.lgTripComment.create({
    data: {
      tripId: trip5.id,
      authorId: admin.id,
      content: 'Déplacement validé. Clôturé.',
    },
  });

  // 6. CANCELLED — M9 Antsirabe, transport en commun
  await prisma.lgTrip.create({
    data: {
      reference: ref(),
      mission: { connect: { id: m9.id } },
      status: LgTripStatus.CANCELLED,
      departureLocation: 'Antananarivo',
      arrivalLocation: 'Antsirabe',
      departureDate: daysFromNow(2),
      arrivalDate: daysFromNow(2),
      purpose: 'Second accompagnateur — remplacé par le véhicule de service',
      transportMode: LgTransportMode.PUBLIC_TRANSPORT,
      requestor: { connect: { id: d1.id } },
    },
  });

  // 7. CANCELLED — M4 Tuléar (en cours), véhicule de service, km relevé au départ
  const trip7 = await prisma.lgTrip.create({
    data: {
      reference: ref(),
      mission: { connect: { id: m4.id } },
      status: LgTripStatus.CANCELLED,
      departureLocation: 'Toliara',
      arrivalLocation: 'Ifaty',
      departureDate: daysFromNow(-1),
      purpose: 'Visite partenaire local — programme pêche artisanale',
      transportMode: LgTransportMode.SERVICE_VEHICLE,
      departureKm: '47820.0',
      requestor: { connect: { id: d2.id } },
      vehicle: { connect: { id: v2.id } },
    },
  });
  await prisma.lgTripComment.create({
    data: {
      tripId: trip7.id,
      authorId: admin.id,
      content:
        'Déplacement annulé — rendez-vous reporté par le partenaire. Véhicule réaffecté au planning.',
    },
  });

  // 8. PENDING — M4 Tuléar, bateau
  await prisma.lgTrip.create({
    data: {
      reference: ref(),
      mission: { connect: { id: m4.id } },
      status: LgTripStatus.PENDING,
      departureLocation: 'Toliara',
      arrivalLocation: 'Anakao',
      departureDate: daysFromNow(1),
      arrivalDate: daysFromNow(1),
      purpose: 'Enquête accès à l’eau potable — communautés côtières',
      transportMode: LgTransportMode.BOAT,
      notes: 'Traversée en bateau express. Prévoir équipement de terrain.',
      requestor: { connect: { id: d2.id } },
    },
  });

  // 9. PENDING — M10 Morondava, autre moyen avec relevés
  await prisma.lgTrip.create({
    data: {
      reference: ref(),
      mission: { connect: { id: m10.id } },
      status: LgTripStatus.PENDING,
      departureLocation: 'Morondava',
      arrivalLocation: 'Belo-sur-Tsiribihina',
      departureDate: daysFromNow(2),
      purpose: 'Réunion de suivi avec les associations paysannes',
      transportMode: LgTransportMode.OTHER,
      departureKm: '23100.0',
      arrivalKm: '23258.0',
      distanceKm: '158.0',
      notes: 'Transport partagé avec ONG partenaire.',
      requestor: { connect: { id: d1.id } },
    },
  });

  // 10. PROCESSED — M4 Tuléar, véhicule de service, aller complet
  const trip10 = await prisma.lgTrip.create({
    data: {
      reference: ref(),
      mission: { connect: { id: m4.id } },
      status: LgTripStatus.PROCESSED,
      departureLocation: 'Toliara',
      arrivalLocation: 'Sakaraha',
      departureDate: daysFromNow(-2),
      arrivalDate: daysFromNow(-2),
      purpose: 'Suivi des sites de distribution — Sakaraha',
      transportMode: LgTransportMode.SERVICE_VEHICLE,
      departureKm: '47600.0',
      arrivalKm: '47820.0',
      distanceKm: '220.0',
      requestor: { connect: { id: d2.id } },
      vehicle: { connect: { id: v2.id } },
    },
  });
  await prisma.lgTripComment.create({
    data: {
      tripId: trip10.id,
      authorId: admin.id,
      content: 'Kilométrage cohérent avec le suivi du parc. Traité.',
    },
  });

  await prisma.lgTripComment.createMany({
    data: [
      {
        tripId: trip1.id,
        authorId: d1.id,
        content: 'Départ prévu à 07h00 depuis le siège. Retour le soir même.',
      },
      {
        tripId: trip1.id,
        authorId: admin.id,
        content: 'Bien reçu. En attente de validation du planning véhicules.',
      },
    ],
  });

  console.log(
    'Déplacements: 10 dossiers sur 6 trajets | PENDING ×5 | PROCESSED ×3 | CANCELLED ×2 | commentaires ×7',
  );
}
