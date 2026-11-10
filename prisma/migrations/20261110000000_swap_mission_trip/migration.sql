-- !!! APPLY MANUALLY !!!
--   npx prisma db execute --file prisma/migrations/20261110000000_swap_mission_trip/migration.sql
--   then, if the DB is baselined with Prisma Migrate:
--   npx prisma migrate resolve --applied 20261110000000_swap_mission_trip
-- NEVER run `prisma db push` on this schema before applying this file:
-- db push would DROP and recreate the lg_deplacement* tables (data loss).
--
-- Swap: LgDeplacement (mission request, UI "Trajet") -> LgMission; LgTrip now requires a mission.
-- RENAME-based: zero data loss on lg_missions*. Only trip data is purged.
-- Transactional: a failure rolls back everything.
BEGIN;

-- (a) Purge trip data (trips now require a mission)
DELETE FROM "lg_comments" WHERE "entityType" = 'TRIP';
DELETE FROM "lg_trip_comments";
DELETE FROM "lg_trips";

-- (b) Enums (column defaults reference enum values by OID, so renamed values carry over)
ALTER TYPE "LgDeplacementStatus" RENAME TO "LgMissionStatus";
ALTER TYPE "LgMissionStatus" RENAME VALUE 'EN_ATTENTE' TO 'PENDING';
ALTER TYPE "LgMissionStatus" RENAME VALUE 'VEHICULE_ATTRIBUE' TO 'VEHICLE_ASSIGNED';
ALTER TYPE "LgMissionStatus" RENAME VALUE 'EN_ATTENTE_LOCATION' TO 'PENDING_RENTAL';
ALTER TYPE "LgMissionStatus" RENAME VALUE 'CONFIRMEE' TO 'CONFIRMED';
ALTER TYPE "LgMissionStatus" RENAME VALUE 'EN_COURS' TO 'IN_PROGRESS';
ALTER TYPE "LgMissionStatus" RENAME VALUE 'LIQUIDEE' TO 'SETTLED';
ALTER TYPE "LgMissionStatus" RENAME VALUE 'LIQUIDATION_VALIDEE' TO 'SETTLEMENT_APPROVED';
ALTER TYPE "LgMissionStatus" RENAME VALUE 'LIQUIDATION_REJETEE' TO 'SETTLEMENT_REJECTED';
ALTER TYPE "LgMissionStatus" RENAME VALUE 'REFUSEE' TO 'REJECTED';
ALTER TYPE "LgMissionStatus" RENAME VALUE 'ANNULEE' TO 'CANCELLED';

ALTER TYPE "LgTypeMission" RENAME TO "LgMissionType";
ALTER TYPE "LgMissionType" RENAME VALUE 'DEPLACEMENT_NATIONAL' TO 'NATIONAL';
ALTER TYPE "LgMissionType" RENAME VALUE 'DEPLACEMENT_REGIONAL' TO 'REGIONAL';
ALTER TYPE "LgMissionType" RENAME VALUE 'DEPLACEMENT_INTERNATIONAL' TO 'INTERNATIONAL';

ALTER TYPE "LgLiquidationValidationStatus" RENAME TO "LgSettlementValidationStatus";
ALTER TYPE "LgSettlementValidationStatus" RENAME VALUE 'EN_ATTENTE' TO 'PENDING';
ALTER TYPE "LgSettlementValidationStatus" RENAME VALUE 'VALIDEE' TO 'APPROVED';
ALTER TYPE "LgSettlementValidationStatus" RENAME VALUE 'REJETEE' TO 'REJECTED';

ALTER TYPE "LgLiquidationValidatorRole" RENAME TO "LgSettlementValidatorRole";

ALTER TYPE "CommentEntityType" RENAME VALUE 'DEPLACEMENT' TO 'MISSION';

-- (c) Tables
ALTER TABLE "lg_deplacements" RENAME TO "lg_missions";
ALTER TABLE "lg_deplacement_liquidations" RENAME TO "lg_mission_settlements";
ALTER TABLE "lg_liquidation_validations" RENAME TO "lg_settlement_validations";
ALTER TABLE "lg_deplacement_comments" RENAME TO "lg_mission_comments";

-- (d) Columns
ALTER TABLE "lg_missions" RENAME COLUMN "objet" TO "purpose";
ALTER TABLE "lg_missions" RENAME COLUMN "dateDepart" TO "departureDate";
ALTER TABLE "lg_missions" RENAME COLUMN "dateRetour" TO "returnDate";
ALTER TABLE "lg_missions" RENAME COLUMN "typeMission" TO "missionType";
ALTER TABLE "lg_missions" RENAME COLUMN "nombrePersonnes" TO "passengerCount";
ALTER TABLE "lg_missions" RENAME COLUMN "passagers" TO "passengers";
ALTER TABLE "lg_missions" RENAME COLUMN "motifRefus" TO "rejectionReason";
ALTER TABLE "lg_missions" RENAME COLUMN "montantPerDiem" TO "perDiemAmount";
ALTER TABLE "lg_missions" RENAME COLUMN "instructionsComplementaires" TO "additionalInstructions";
ALTER TABLE "lg_missions" RENAME COLUMN "gestionnairId" TO "managerId";

ALTER TABLE "lg_mission_settlements" RENAME COLUMN "deplacementId" TO "missionId";
ALTER TABLE "lg_mission_settlements" RENAME COLUMN "fraisTransport" TO "transportCost";
ALTER TABLE "lg_mission_settlements" RENAME COLUMN "fraisHebergement" TO "accommodationCost";
ALTER TABLE "lg_mission_settlements" RENAME COLUMN "fraisRestauration" TO "mealCost";
ALTER TABLE "lg_mission_settlements" RENAME COLUMN "autresFrais" TO "otherCosts";
ALTER TABLE "lg_mission_settlements" RENAME COLUMN "totalLiquidation" TO "totalAmount";
ALTER TABLE "lg_mission_settlements" RENAME COLUMN "observations" TO "remarks";
ALTER TABLE "lg_mission_settlements" RENAME COLUMN "dateDepotLiquidation" TO "submittedAt";

ALTER TABLE "lg_settlement_validations" RENAME COLUMN "liquidationId" TO "settlementId";
ALTER TABLE "lg_settlement_validations" RENAME COLUMN "commentaire" TO "comment";

ALTER TABLE "lg_mission_comments" RENAME COLUMN "deplacementId" TO "missionId";

-- (e) Constraints and indexes -> Prisma default names
-- lg_missions
ALTER TABLE "lg_missions" RENAME CONSTRAINT "lg_deplacements_pkey" TO "lg_missions_pkey";
ALTER TABLE "lg_missions" RENAME CONSTRAINT "lg_deplacements_requestorId_fkey" TO "lg_missions_requestorId_fkey";
ALTER TABLE "lg_missions" RENAME CONSTRAINT "lg_deplacements_gestionnairId_fkey" TO "lg_missions_managerId_fkey";
ALTER TABLE "lg_missions" RENAME CONSTRAINT "lg_deplacements_vehicleId_fkey" TO "lg_missions_vehicleId_fkey";
ALTER TABLE "lg_missions" RENAME CONSTRAINT "lg_deplacements_linkedPurchaseId_fkey" TO "lg_missions_linkedPurchaseId_fkey";
ALTER INDEX "lg_deplacements_reference_key" RENAME TO "lg_missions_reference_key";
ALTER INDEX "lg_deplacements_linkedPurchaseId_key" RENAME TO "lg_missions_linkedPurchaseId_key";
ALTER INDEX "lg_deplacements_status_idx" RENAME TO "lg_missions_status_idx";
ALTER INDEX "lg_deplacements_requestorId_idx" RENAME TO "lg_missions_requestorId_idx";
ALTER INDEX "lg_deplacements_vehicleId_idx" RENAME TO "lg_missions_vehicleId_idx";
ALTER INDEX "lg_deplacements_dateDepart_idx" RENAME TO "lg_missions_departureDate_idx";
ALTER INDEX "lg_deplacements_dateRetour_idx" RENAME TO "lg_missions_returnDate_idx";
ALTER INDEX "lg_deplacements_createdAt_idx" RENAME TO "lg_missions_createdAt_idx";
ALTER INDEX "lg_deplacements_deletedAt_idx" RENAME TO "lg_missions_deletedAt_idx";

-- lg_mission_settlements
ALTER TABLE "lg_mission_settlements" RENAME CONSTRAINT "lg_deplacement_liquidations_pkey" TO "lg_mission_settlements_pkey";
ALTER TABLE "lg_mission_settlements" RENAME CONSTRAINT "lg_deplacement_liquidations_submittedById_fkey" TO "lg_mission_settlements_submittedById_fkey";
ALTER TABLE "lg_mission_settlements" RENAME CONSTRAINT "lg_deplacement_liquidations_deplacementId_fkey" TO "lg_mission_settlements_missionId_fkey";
ALTER INDEX "lg_deplacement_liquidations_deplacementId_key" RENAME TO "lg_mission_settlements_missionId_key";
ALTER INDEX "lg_deplacement_liquidations_deplacementId_idx" RENAME TO "lg_mission_settlements_missionId_idx";

-- lg_settlement_validations
ALTER TABLE "lg_settlement_validations" RENAME CONSTRAINT "lg_liquidation_validations_pkey" TO "lg_settlement_validations_pkey";
ALTER TABLE "lg_settlement_validations" RENAME CONSTRAINT "lg_liquidation_validations_liquidationId_fkey" TO "lg_settlement_validations_settlementId_fkey";
ALTER TABLE "lg_settlement_validations" RENAME CONSTRAINT "lg_liquidation_validations_validatorId_fkey" TO "lg_settlement_validations_validatorId_fkey";
ALTER INDEX "lg_liquidation_validations_liquidationId_idx" RENAME TO "lg_settlement_validations_settlementId_idx";
ALTER INDEX "lg_liquidation_validations_status_idx" RENAME TO "lg_settlement_validations_status_idx";
ALTER INDEX "lg_liquidation_validations_liquidationId_role_key" RENAME TO "lg_settlement_validations_settlementId_role_key";

-- lg_mission_comments
ALTER TABLE "lg_mission_comments" RENAME CONSTRAINT "lg_deplacement_comments_pkey" TO "lg_mission_comments_pkey";
ALTER TABLE "lg_mission_comments" RENAME CONSTRAINT "lg_deplacement_comments_deplacementId_fkey" TO "lg_mission_comments_missionId_fkey";
ALTER TABLE "lg_mission_comments" RENAME CONSTRAINT "lg_deplacement_comments_authorId_fkey" TO "lg_mission_comments_authorId_fkey";
ALTER INDEX "lg_deplacement_comments_deplacementId_idx" RENAME TO "lg_mission_comments_missionId_idx";
ALTER INDEX "lg_deplacement_comments_authorId_idx" RENAME TO "lg_mission_comments_authorId_idx";
ALTER INDEX "lg_deplacement_comments_createdAt_idx" RENAME TO "lg_mission_comments_createdAt_idx";

-- (f) lg_trips.missionId (table is empty after the purge above)
ALTER TABLE "lg_trips" ADD COLUMN "missionId" TEXT NOT NULL;
CREATE INDEX "lg_trips_missionId_idx" ON "lg_trips"("missionId");
ALTER TABLE "lg_trips" ADD CONSTRAINT "lg_trips_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "lg_missions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- (g) Mission references DEP- -> TRJ-
UPDATE "lg_missions" SET "reference" = 'TRJ-' || substring("reference" from 5) WHERE "reference" LIKE 'DEP-%';

-- (h) Notifications
UPDATE "notifications" SET "type" = 'MISSION_CREATED' WHERE "type" = 'DEPLACEMENT_NOUVEAU';
UPDATE "notifications" SET "type" = 'MISSION_STATUS_CHANGED' WHERE "type" = 'DEPLACEMENT_STATUS_CHANGED';
UPDATE "notifications" SET "type" = 'MISSION_CONFIRMED' WHERE "type" = 'DEPLACEMENT_CONFIRME';
UPDATE "notifications" SET "type" = 'MISSION_SETTLED' WHERE "type" = 'DEPLACEMENT_LIQUIDE';
UPDATE "notifications" SET "type" = 'SETTLEMENT_VALIDATION_REQUIRED' WHERE "type" = 'LIQUIDATION_VALIDATION_REQUISE';
UPDATE "notifications" SET "type" = 'SETTLEMENT_REJECTED' WHERE "type" = 'LIQUIDATION_REJETEE';
UPDATE "notifications" SET "type" = 'SETTLEMENT_APPROVED' WHERE "type" = 'LIQUIDATION_VALIDEE_COMPLETE';
UPDATE "notifications" SET "resourceType" = 'MISSION' WHERE "resourceType" = 'DEPLACEMENT';

COMMIT;
