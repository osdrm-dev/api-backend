import { PrismaClient, LgTripStatus, LgTransportMode } from '@prisma/client';

const today = new Date();
const daysFromNow = (n: number) => new Date(today.getTime() + n * 86_400_000);
const year = today.getFullYear();

// Trips that use a vehicle record odometer readings; others (plane, taxi, boat, public transport) don't.
// distanceKm is always computed as arrivalKm - departureKm when both are provided.

export async function seedTrip(
  prisma: PrismaClient,
  userMap: Record<string, any>,
) {
  await prisma.lgTripComment.deleteMany();
  await prisma.lgTrip.deleteMany();

  const admin = userMap['admin'];
  const d1 = userMap['demandeur1'];
  const d2 = userMap['demandeur2'];

  const v1 = await prisma.vehicle.findFirstOrThrow({
    where: { immatriculation: '1234 TAA 101' },
  });
  const v2 = await prisma.vehicle.findFirstOrThrow({
    where: { immatriculation: '5678 TAA 202' },
  });

  // 1. PENDING — Pierre Andry, véhicule de service vers Antsirabe
  //    Odometer at departure known; arrival not yet recorded (trip in future).
  const trip1 = await prisma.lgTrip.create({
    data: {
      reference: `TRJ-${year}-0001`,
      status: LgTripStatus.PENDING,
      departureLocation: 'Antananarivo — Siège OSDRM',
      arrivalLocation: 'Antsirabe',
      departureDate: daysFromNow(3),
      arrivalDate: daysFromNow(3),
      purpose:
        'Visite de supervision programme nutrition district Vakinankaratra',
      transportMode: LgTransportMode.SERVICE_VEHICLE,
      departureKm: '12450.0',
      // arrivalKm not yet known — trip hasn't happened
      requestor: { connect: { id: d1.id } },
      vehicle: { connect: { id: v1.id } },
    },
  });

  // 2. PENDING — Julie Fara, taxi vers Ivato
  //    Taxi: no odometer readings available.
  await prisma.lgTrip.create({
    data: {
      reference: `TRJ-${year}-0002`,
      status: LgTripStatus.PENDING,
      departureLocation: 'Bureau OSDRM Analakely',
      arrivalLocation: "Aéroport d'Ivato",
      departureDate: daysFromNow(1),
      purpose: "Transport vers l'aéroport pour mission internationale",
      transportMode: LgTransportMode.TAXI,
      requestor: { connect: { id: d2.id } },
    },
  });

  // 3. PENDING — Pierre Andry, moto vers Ambohidratrimo
  //    Both readings entered at creation (known circuit).
  await prisma.lgTrip.create({
    data: {
      reference: `TRJ-${year}-0003`,
      status: LgTripStatus.PENDING,
      departureLocation: 'Antananarivo',
      arrivalLocation: 'Ambohidratrimo',
      departureDate: daysFromNow(5),
      purpose: 'Collecte de données terrain — enquête ménage WASH',
      transportMode: LgTransportMode.MOTORCYCLE,
      departureKm: '8730.0',
      arrivalKm: '8752.5',
      distanceKm: '22.5',
      notes: 'Zone enclavée, moto recommandée par le chef de projet.',
      requestor: { connect: { id: d1.id } },
    },
  });

  // 4. PROCESSED — Julie Fara, transport en commun Antananarivo → Toamasina
  //    Bus: no odometer. Distance not recorded.
  const trip4 = await prisma.lgTrip.create({
    data: {
      reference: `TRJ-${year}-0004`,
      status: LgTripStatus.PROCESSED,
      departureLocation: 'Antananarivo',
      arrivalLocation: 'Toamasina',
      departureDate: daysFromNow(-10),
      arrivalDate: daysFromNow(-9),
      purpose: 'Réunion de coordination avec partenaires régionaux UNICEF',
      transportMode: LgTransportMode.PUBLIC_TRANSPORT,
      requestor: { connect: { id: d2.id } },
    },
  });

  await prisma.lgTripComment.create({
    data: {
      tripId: trip4.id,
      authorId: admin.id,
      content: 'Dossier examiné. Trajet validé et enregistré dans le système.',
    },
  });

  await prisma.lgTripComment.create({
    data: {
      tripId: trip4.id,
      authorId: d2.id,
      content: "Mission accomplie. Rapport de mission transmis à l'équipe.",
    },
  });

  // 5. PROCESSED — Pierre Andry, avion Antananarivo → Nairobi
  //    Plane: no odometer readings.
  const trip5 = await prisma.lgTrip.create({
    data: {
      reference: `TRJ-${year}-0005`,
      status: LgTripStatus.PROCESSED,
      departureLocation: "Antananarivo — Aéroport d'Ivato",
      arrivalLocation: 'Nairobi — Aéroport International Jomo Kenyatta',
      departureDate: daysFromNow(-30),
      arrivalDate: daysFromNow(-25),
      purpose:
        'Participation conférence régionale East Africa Nutrition Summit',
      transportMode: LgTransportMode.PLANE,
      notes: 'Vol Air Madagascar + Ethiopian Airlines. Escale Addis-Abeba.',
      requestor: { connect: { id: d1.id } },
    },
  });

  await prisma.lgTripComment.create({
    data: {
      tripId: trip5.id,
      authorId: admin.id,
      content: 'Trajet professionnel international validé. Clôturé.',
    },
  });

  // 6. CANCELLED — Julie Fara, transport en commun Antananarivo → Mahajanga
  //    Cancelled before departure: no odometer readings.
  await prisma.lgTrip.create({
    data: {
      reference: `TRJ-${year}-0006`,
      status: LgTripStatus.CANCELLED,
      departureLocation: 'Antananarivo',
      arrivalLocation: 'Mahajanga',
      departureDate: daysFromNow(2),
      arrivalDate: daysFromNow(4),
      purpose: 'Atelier de renforcement des capacités — programme SGBV',
      transportMode: LgTransportMode.PUBLIC_TRANSPORT,
      requestor: { connect: { id: d2.id } },
    },
  });

  // 7. CANCELLED — Pierre Andry, véhicule de service vers Morondava
  //    Vehicle assigned (v2 Land Cruiser); trip cancelled after km recorded at departure.
  const trip7 = await prisma.lgTrip.create({
    data: {
      reference: `TRJ-${year}-0007`,
      status: LgTripStatus.CANCELLED,
      departureLocation: 'Antananarivo',
      arrivalLocation: 'Morondava',
      departureDate: daysFromNow(-2),
      purpose: 'Visite partenaire CARE — programme agropastoral',
      transportMode: LgTransportMode.SERVICE_VEHICLE,
      departureKm: '47820.0',
      requestor: { connect: { id: d1.id } },
      vehicle: { connect: { id: v2.id } },
    },
  });

  await prisma.lgTripComment.create({
    data: {
      tripId: trip7.id,
      authorId: admin.id,
      content:
        'Trajet annulé — mission reportée par le partenaire CARE. Véhicule réaffecté au planning.',
    },
  });

  // 8. PENDING — Julie Fara, bateau Soanierana-Ivongo → Île Sainte-Marie
  //    Boat: no odometer.
  await prisma.lgTrip.create({
    data: {
      reference: `TRJ-${year}-0008`,
      status: LgTripStatus.PENDING,
      departureLocation: 'Soanierana-Ivongo',
      arrivalLocation: 'Île Sainte-Marie',
      departureDate: daysFromNow(14),
      arrivalDate: daysFromNow(16),
      purpose:
        'Enquête de terrain — évaluation accès à eau potable communautés côtières',
      transportMode: LgTransportMode.BOAT,
      notes:
        'Traversée en bateau express. Prévoir équipement de terrain complet.',
      requestor: { connect: { id: d2.id } },
    },
  });

  // 9. PENDING — Pierre Andry, autre moyen (transport partagé) vers Ambositra
  //    Both readings provided at creation.
  await prisma.lgTrip.create({
    data: {
      reference: `TRJ-${year}-0009`,
      status: LgTripStatus.PENDING,
      departureLocation: 'Antananarivo',
      arrivalLocation: 'Ambositra',
      departureDate: daysFromNow(7),
      purpose: 'Réunion de suivi indicateurs programme éducation',
      transportMode: LgTransportMode.OTHER,
      departureKm: '23100.0',
      arrivalKm: '23358.0',
      distanceKm: '258.0',
      notes: 'Transport partagé avec ONG partenaire.',
      requestor: { connect: { id: d1.id } },
    },
  });

  // Comments on trip1 — pending conversation
  await prisma.lgTripComment.create({
    data: {
      tripId: trip1.id,
      authorId: d1.id,
      content: 'Départ prévu à 07h00 depuis le siège. Retour le soir même.',
    },
  });

  await prisma.lgTripComment.create({
    data: {
      tripId: trip1.id,
      authorId: admin.id,
      content: 'Bien reçu. En attente de validation du planning véhicules.',
    },
  });

  console.log(
    `Trajets: 9 dossiers | PENDING ×5 | PROCESSED ×2 | CANCELLED ×2 | commentaires ×6`,
  );
}
