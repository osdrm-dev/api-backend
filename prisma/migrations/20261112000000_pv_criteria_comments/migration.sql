-- One free-text comment per PV evaluation criterion, shared by all suppliers: { "<criterionKey>": "comment" }
ALTER TABLE "pvs" ADD COLUMN "criteriaComments" JSONB;
