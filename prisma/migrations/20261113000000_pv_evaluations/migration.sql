-- !!! APPLY MANUALLY !!!
--   npx prisma db execute --file prisma/migrations/20261113000000_pv_evaluations/migration.sql
--   then, if the DB is baselined with Prisma Migrate:
--   npx prisma migrate resolve --applied 20261113000000_pv_evaluations
-- Requires 20261112000000_pv_criteria_comments to be applied first (reads pvs."criteriaComments").
--
-- PV evaluation grid moves from the buyer (pv_suppliers columns) to per-user pv_evaluations.
-- Existing PVs keep the buyer as only evaluator (daEvaluationsRequired = false).
-- Answers are keyed by supplierId; pv_suppliers without supplierId fall back to 'pvSupplier:<id>'.
-- Transactional: a failure rolls back everything.
BEGIN;

CREATE TYPE "PVEvaluationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'WAIVED');

CREATE TABLE "pv_evaluations" (
  "id" TEXT NOT NULL,
  "pvId" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "answers" JSONB,
  "criteriaComments" JSONB,
  "status" "PVEvaluationStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  "waivedById" INTEGER,
  "waivedReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pv_evaluations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pv_evaluations_pvId_userId_key" ON "pv_evaluations"("pvId", "userId");
CREATE INDEX "pv_evaluations_userId_idx" ON "pv_evaluations"("userId");

ALTER TABLE "pv_evaluations" ADD CONSTRAINT "pv_evaluations_pvId_fkey"
  FOREIGN KEY ("pvId") REFERENCES "pvs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pv_evaluations" ADD CONSTRAINT "pv_evaluations_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pv_evaluations" ADD CONSTRAINT "pv_evaluations_waivedById_fkey"
  FOREIGN KEY ("waivedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pvs" ADD COLUMN "daEvaluationsRequired" BOOLEAN NOT NULL DEFAULT true;

-- One evaluation per existing PV whose purchase has a buyer.
-- gen_random_uuid() is built in since PostgreSQL 13; otherwise use md5(random()::text || pv.id).
INSERT INTO "pv_evaluations"
  ("id", "pvId", "userId", "answers", "criteriaComments", "status", "submittedAt", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  pv."id",
  pu."acheteurId",
  agg.answers,
  pv."criteriaComments",
  CASE WHEN pv."status" = 'DRAFT' THEN 'DRAFT' ELSE 'SUBMITTED' END::"PVEvaluationStatus",
  CASE WHEN pv."status" = 'DRAFT' THEN NULL ELSE pv."updatedAt" END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "pvs" pv
JOIN "purchases" pu ON pu."id" = pv."purchaseId"
LEFT JOIN LATERAL (
  SELECT jsonb_object_agg(
    COALESCE(ps."supplierId", 'pvSupplier:' || ps."id"),
    jsonb_strip_nulls(jsonb_build_object(
          'reponseDansDelai', ps."reponseDansDelai",
          'annexe1', ps."annexe1",
          'devisSpecifications', ps."devisSpecifications",
          'regulariteFiscale', ps."regulariteFiscale",
          'copiecin', ps."copiecin",
          'conformiteSpecs', ps."conformiteSpecs",
          'distanceBureaux', ps."distanceBureaux",
          'delaiLivraison', ps."delaiLivraison",
          'sav', ps."sav",
          'disponibiliteArticles', ps."disponibiliteArticles",
          'qualiteArticles', ps."qualiteArticles",
          'experienceAnterieure', ps."experienceAnterieure",
          'producteurOuSousTraitant', ps."producteurOuSousTraitant",
          'echantillonBat', ps."echantillonBat",
          'validiteOffre', ps."validiteOffre",
          'modePaiement', ps."modePaiement",
          'delaiPaiement', ps."delaiPaiement"
    ))
  ) AS answers
  FROM "pv_suppliers" ps
  WHERE ps."pvId" = pv."id"
) agg ON true
WHERE pu."acheteurId" IS NOT NULL;

UPDATE "pvs" SET "daEvaluationsRequired" = false;

ALTER TABLE "pv_suppliers"
  DROP COLUMN "reponseDansDelai",
  DROP COLUMN "annexe1",
  DROP COLUMN "devisSpecifications",
  DROP COLUMN "regulariteFiscale",
  DROP COLUMN "copiecin",
  DROP COLUMN "conformiteSpecs",
  DROP COLUMN "distanceBureaux",
  DROP COLUMN "delaiLivraison",
  DROP COLUMN "sav",
  DROP COLUMN "disponibiliteArticles",
  DROP COLUMN "qualiteArticles",
  DROP COLUMN "experienceAnterieure",
  DROP COLUMN "producteurOuSousTraitant",
  DROP COLUMN "echantillonBat",
  DROP COLUMN "validiteOffre",
  DROP COLUMN "modePaiement",
  DROP COLUMN "delaiPaiement";
ALTER TABLE "pvs" DROP COLUMN IF EXISTS "criteriaComments";

COMMIT;
