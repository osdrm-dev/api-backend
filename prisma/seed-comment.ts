import { CommentEntityType, PrismaClient } from '@prisma/client';

const today = new Date();
const daysAgo = (n: number) => new Date(today.getTime() - n * 86_400_000);
const year = today.getFullYear();

// L'API lit/écrit les commentaires uniquement via lg_comments (UnifiedCommentService).
// On y recopie donc les commentaires des anciennes tables (trajet, déplacement,
// carburant, entretien), puis on ajoute des commentaires de liquidation et d'achat.
export async function seedComment(
  prisma: PrismaClient,
  userMap: Record<string, any>,
) {
  await prisma.lgComment.deleteMany();

  const T = CommentEntityType;
  const legacy: [CommentEntityType, string, any][] = [
    ...(await prisma.lgMissionComment.findMany()).map(
      (c): [CommentEntityType, string, any] => [T.MISSION, c.missionId, c],
    ),
    ...(await prisma.lgTripComment.findMany()).map(
      (c): [CommentEntityType, string, any] => [T.TRIP, c.tripId, c],
    ),
    ...(await prisma.lgCarburantComment.findMany()).map(
      (c): [CommentEntityType, string, any] => [T.CARBURANT, c.carburantId, c],
    ),
    ...(await prisma.maintenanceComment.findMany()).map(
      (c): [CommentEntityType, string, any] => [T.MAINTENANCE, c.requestId, c],
    ),
  ];

  const data: any[] = legacy.map(([entityType, entityId, c]) => ({
    entityType,
    entityId,
    authorId: c.authorId,
    content: c.content,
    createdAt: c.createdAt,
    updatedAt: c.createdAt,
  }));
  const legacyCount = data.length;

  // Commentaires de liquidation sur les trajets concernés
  const extra: [string, string, string, number][] = [
    [
      '0005',
      'gp',
      'Liquidation reçue, en attente des validations DEMANDEUR / OM / CFO.',
      15,
    ],
    ['0011', 'cfo', 'Liquidation approuvée, paiement lancé.', 38],
    [
      '0012',
      'cfo',
      'Liquidation rejetée : justificatifs manquants pour les autres frais.',
      24,
    ],
    ['0012', 'demandeur1', 'Reçu, je complète le dossier et je resoumets.', 23],
    ['0013', 'om', 'Validation OM faite, en attente du CFO.', 7],
    [
      '0010',
      'gp',
      'Véhicule de terrain disponible sur place. Contacter Hery pour tout besoin.',
      3,
    ],
  ];
  for (const [suffix, authorKey, content, ago] of extra) {
    const mission = await prisma.lgMission.findUnique({
      where: { reference: `TRJ-${year}-${suffix}` },
    });
    if (!mission) continue;
    data.push({
      entityType: CommentEntityType.MISSION,
      entityId: mission.id,
      authorId: userMap[authorKey].id,
      content,
      createdAt: daysAgo(ago),
      updatedAt: daysAgo(ago),
    });
  }

  // Quelques commentaires sur un dossier d'achat (PURCHASE porte l'étape courante)
  const purchase = await prisma.purchase.findFirst({
    orderBy: { createdAt: 'asc' },
  });
  let purchaseCount = 0;
  if (purchase) {
    const purchaseComments: [string, string, number][] = [
      ['acheteur', 'Devis demandés auprès de trois fournisseurs.', 6],
      ['cfo', 'Merci de confirmer la ligne budgétaire avant validation.', 4],
    ];
    for (const [authorKey, content, ago] of purchaseComments) {
      data.push({
        entityType: CommentEntityType.PURCHASE,
        entityId: purchase.id,
        authorId: userMap[authorKey].id,
        content,
        currentStep: purchase.currentStep,
        createdAt: daysAgo(ago),
        updatedAt: daysAgo(ago),
      });
      purchaseCount++;
    }
  }

  await prisma.lgComment.createMany({ data });

  console.log(
    `Commentaires unifiés: ${data.length} (${legacyCount} recopiés des tables historiques | ${extra.length} liquidation/trajet | ${purchaseCount} achat)`,
  );
}
