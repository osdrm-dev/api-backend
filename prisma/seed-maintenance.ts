import {
  PrismaClient,
  MaintenanceStatus,
  MaintenanceInterventionType,
  MaintenanceUrgencyLevel,
} from '@prisma/client';

const today = new Date();
const daysAgo = (n: number) => new Date(today.getTime() - n * 86_400_000);
const daysFromNow = (n: number) => new Date(today.getTime() + n * 86_400_000);

export async function seedMaintenance(
  prisma: PrismaClient,
  userMap: Record<string, any>,
) {
  await prisma.maintenanceComment.deleteMany();
  await prisma.maintenanceRequest.deleteMany();

  const requests = [
    // 1. PENDING — recent, urgent
    {
      reference: 'ENT-2026-0001',
      interventionType: MaintenanceInterventionType.REPARATION,
      urgencyLevel: MaintenanceUrgencyLevel.URGENTE,
      status: MaintenanceStatus.PENDING,
      title: `Pneu avant gauche crevé — Toyota Hilux`,
      description: `Le véhicule ne peut plus circuler. Pneu avant gauche complètement à plat suite à un clou sur la piste de Toamasina Nord. Remplacement immédiat nécessaire.`,
      location: `Toamasina — Site Nord`,
      vehicleRef: `1234 TAA 101`,
      requestorKey: `demandeur1`,
      createdAt: daysAgo(1),
    },
    // 2. PENDING — normal urgency
    {
      reference: `ENT-2026-0002`,
      interventionType: MaintenanceInterventionType.ENTRETIEN_PREVENTIF,
      urgencyLevel: MaintenanceUrgencyLevel.NORMALE,
      status: MaintenanceStatus.PENDING,
      title: `Vidange et filtre à huile — Land Cruiser 5678`,
      description: `Révision périodique à 80 000 km. Vidange huile moteur, remplacement filtre à huile, vérification niveaux.`,
      location: `Garage central Antananarivo`,
      vehicleRef: `5678 TAA 202`,
      requestorKey: `demandeur2`,
      createdAt: daysAgo(3),
    },
    // 3. PENDING — low urgency, no vehicle
    {
      reference: `ENT-2026-0003`,
      interventionType: MaintenanceInterventionType.INSPECTION,
      urgencyLevel: MaintenanceUrgencyLevel.FAIBLE,
      status: MaintenanceStatus.PENDING,
      title: `Inspection générale climatisation bureau`,
      description: `Inspection annuelle de la climatisation des salles de réunion du siège. Nettoyage filtres et vérification des fluides frigorigènes.`,
      location: `Siège social — Antananarivo`,
      vehicleRef: null as string | null,
      requestorKey: `demandeur1`,
      createdAt: daysAgo(5),
    },
    // 4. IN_PROGRESS — critical, technician assigned, scheduled
    {
      reference: `ENT-2026-0004`,
      interventionType: MaintenanceInterventionType.REPARATION,
      urgencyLevel: MaintenanceUrgencyLevel.CRITIQUE,
      status: MaintenanceStatus.IN_PROGRESS,
      title: `Fuite hydraulique — Mitsubishi L200`,
      description: `Fuite importante détectée sur le circuit hydraulique de direction assistée. Véhicule immobilisé. Intervention urgente requise pour éviter toute immobilisation prolongée.`,
      location: `Dépôt Fianarantsoa`,
      vehicleRef: `9012 TAB 303`,
      requestorKey: `demandeur2`,
      assignedToKey: `admin`,
      technicianName: `Jean-Baptiste Razafindrakoto`,
      scheduledAt: daysFromNow(1),
      observations: `Pièces commandées. Technicien dépêché demain matin.`,
      createdAt: daysAgo(4),
    },
    // 5. IN_PROGRESS — normal urgency, corrective
    {
      reference: `ENT-2026-0005`,
      interventionType: MaintenanceInterventionType.ENTRETIEN_CORRECTIF,
      urgencyLevel: MaintenanceUrgencyLevel.NORMALE,
      status: MaintenanceStatus.IN_PROGRESS,
      title: `Remplacement batterie — Nissan Navara`,
      description: `La batterie ne tient plus la charge. Démarrages difficiles notamment le matin. Remplacement de la batterie nécessaire.`,
      location: `Parking bureau Mahajanga`,
      vehicleRef: `3456 TAC 404`,
      requestorKey: `demandeur1`,
      assignedToKey: `admin`,
      technicianName: `Hery Rasolonjatovo`,
      scheduledAt: daysFromNow(2),
      createdAt: daysAgo(6),
    },
    // 6. VALIDATED — completed last week
    {
      reference: `ENT-2026-0006`,
      interventionType: MaintenanceInterventionType.ENTRETIEN_PREVENTIF,
      urgencyLevel: MaintenanceUrgencyLevel.NORMALE,
      status: MaintenanceStatus.VALIDATED,
      title: `Révision 60 000 km — Ford Ranger`,
      description: `Révision complète à 60 000 km : vidange, filtres, courroie de distribution, plaquettes de frein.`,
      location: `Garage central Antananarivo`,
      vehicleRef: `7890 TAD 505`,
      requestorKey: `demandeur2`,
      assignedToKey: `admin`,
      technicianName: `Toky Andriantsoa`,
      scheduledAt: daysAgo(10),
      completedAt: daysAgo(8),
      observations: `Révision effectuée. Courroie et plaquettes remplacées. Véhicule opérationnel.`,
      createdAt: daysAgo(14),
    },
    // 7. VALIDATED — completed this month
    {
      reference: `ENT-2026-0007`,
      interventionType: MaintenanceInterventionType.REPARATION,
      urgencyLevel: MaintenanceUrgencyLevel.URGENTE,
      status: MaintenanceStatus.VALIDATED,
      title: `Réparation pot d'échappement — Toyota RAV4`,
      description: `Pot d'échappement percé causant des nuisances sonores importantes et un risque d'intoxication pour les passagers.`,
      location: `Garage partenaire Toamasina`,
      vehicleRef: `2468 TAE 606`,
      requestorKey: `demandeur1`,
      assignedToKey: `admin`,
      technicianName: `Lalaina Rakotoniaina`,
      scheduledAt: daysAgo(18),
      completedAt: daysAgo(15),
      observations: `Remplacement complet du silencieux effectué.`,
      createdAt: daysAgo(22),
    },
    // 8. VALIDATED — older, completed
    {
      reference: `ENT-2026-0008`,
      interventionType: MaintenanceInterventionType.INSPECTION,
      urgencyLevel: MaintenanceUrgencyLevel.FAIBLE,
      status: MaintenanceStatus.VALIDATED,
      title: `Contrôle technique annuel — Isuzu MU-X`,
      description: `Passage au contrôle technique annuel obligatoire. Mise à jour de la documentation véhicule.`,
      location: `Centre de contrôle technique officiel`,
      vehicleRef: `8024 TAG 808`,
      requestorKey: `demandeur2`,
      assignedToKey: `admin`,
      completedAt: daysAgo(30),
      observations: `Contrôle technique passé avec succès. Vignette renouvelée.`,
      createdAt: daysAgo(35),
    },
    // 9. REJECTED — not justified
    {
      reference: `ENT-2026-0009`,
      interventionType: MaintenanceInterventionType.AUTRE,
      urgencyLevel: MaintenanceUrgencyLevel.FAIBLE,
      status: MaintenanceStatus.REJECTED,
      title: `Installation GPS supplémentaire — Isuzu D-Max archivé`,
      description: `Demande d'installation d'un second GPS de suivi sur le véhicule archivé 1357 TAF 707.`,
      location: `Garage central`,
      vehicleRef: `1357 TAF 707`,
      requestorKey: `demandeur1`,
      assignedToKey: `admin`,
      observations: `Demande rejetée : véhicule archivé, hors parc actif. Aucune intervention autorisée.`,
      createdAt: daysAgo(20),
    },
    // 10. PENDING — this month, critical
    {
      reference: `ENT-2026-0010`,
      interventionType: MaintenanceInterventionType.REPARATION,
      urgencyLevel: MaintenanceUrgencyLevel.CRITIQUE,
      status: MaintenanceStatus.PENDING,
      title: `Rupture de transmission — Toyota Land Cruiser`,
      description: `Transmission arrière défaillante après traversée de terrain accidenté. Véhicule immobilisé sur site distant. Nécessite remorquage et réparation complète.`,
      location: `Site Ambovombe — accès difficile`,
      vehicleRef: `5678 TAA 202`,
      requestorKey: `demandeur2`,
      createdAt: daysAgo(2),
    },
  ];

  const created: Record<string, any> = {};

  for (const r of requests) {
    const req = await prisma.maintenanceRequest.create({
      data: {
        reference: r.reference,
        interventionType: r.interventionType,
        urgencyLevel: r.urgencyLevel,
        status: r.status,
        title: r.title,
        description: r.description,
        ...(r.location && { location: r.location }),
        ...(r.vehicleRef && { vehicleRef: r.vehicleRef }),
        requestorId: userMap[r.requestorKey].id,
        ...('assignedToKey' in r && r.assignedToKey
          ? { assignedToId: userMap[r.assignedToKey].id }
          : {}),
        ...('technicianName' in r && r.technicianName
          ? { technicianName: r.technicianName }
          : {}),
        ...('scheduledAt' in r && r.scheduledAt
          ? { scheduledAt: r.scheduledAt }
          : {}),
        ...('completedAt' in r && r.completedAt
          ? { completedAt: r.completedAt }
          : {}),
        ...('observations' in r && r.observations
          ? { observations: r.observations }
          : {}),
        createdAt: r.createdAt,
      },
    });
    created[r.reference] = req;
  }

  // Comments on selected requests
  const comments = [
    {
      ref: `ENT-2026-0001`,
      authorKey: `admin`,
      content: `Demande bien reçue. Nous vérifions la disponibilité d'un technicien pour demain.`,
      createdAt: daysAgo(0),
    },
    {
      ref: `ENT-2026-0004`,
      authorKey: `admin`,
      content: `Pièce de rechange commandée chez le fournisseur. Délai de livraison estimé : 24h.`,
      createdAt: daysAgo(3),
    },
    {
      ref: `ENT-2026-0004`,
      authorKey: `demandeur2`,
      content: `Confirmé. Le véhicule est bien immobilisé sur site. Le conducteur est en attente.`,
      createdAt: daysAgo(3),
    },
    {
      ref: `ENT-2026-0005`,
      authorKey: `demandeur1`,
      content: `Le démarrage est de plus en plus difficile. Merci d'accélérer si possible.`,
      createdAt: daysAgo(5),
    },
    {
      ref: `ENT-2026-0005`,
      authorKey: `admin`,
      content: `Technicien Hery affecté. Intervention prévue dans 2 jours.`,
      createdAt: daysAgo(4),
    },
    {
      ref: `ENT-2026-0006`,
      authorKey: `admin`,
      content: `Révision terminée avec succès. Bon de sortie signé par le technicien.`,
      createdAt: daysAgo(8),
    },
    {
      ref: `ENT-2026-0009`,
      authorKey: `admin`,
      content: `Véhicule 1357 TAF 707 est archivé depuis 2024. Aucune intervention n'est autorisée sur les véhicules hors parc.`,
      createdAt: daysAgo(19),
    },
    {
      ref: `ENT-2026-0010`,
      authorKey: `admin`,
      content: `Remorquage organisé. Équipe de récupération en route vers Ambovombe.`,
      createdAt: daysAgo(1),
    },
    {
      ref: `ENT-2026-0010`,
      authorKey: `demandeur2`,
      content: `Merci. Le conducteur a été récupéré. Le véhicule attend sur place.`,
      createdAt: daysAgo(1),
    },
  ];

  for (const c of comments) {
    await prisma.maintenanceComment.create({
      data: {
        requestId: created[c.ref].id,
        authorId: userMap[c.authorKey].id,
        content: c.content,
        createdAt: c.createdAt,
      },
    });
  }

  console.log(
    `Maintenance: 10 demandes (4 PENDING | 2 IN_PROGRESS | 3 VALIDATED | 1 REJECTED) | 9 commentaires`,
  );
}
