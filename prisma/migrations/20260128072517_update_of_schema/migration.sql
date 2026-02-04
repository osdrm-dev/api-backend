-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('PROGRAMME', 'OPERATION');

-- CreateEnum
CREATE TYPE "PurchaseStep" AS ENUM ('DA', 'QR', 'PV', 'BC', 'BR', 'INVOICE', 'DAP', 'PROOF_OF_PAYMENT', 'DONE');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'VALIDATED', 'REJECTED', 'IN_DEROGATION', 'CHANGE_REQUESTED');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('QUOTE', 'INVOICE', 'PURCHASE_ORDER', 'DELIVERY_NOTE', 'PROOF_OF_PAYMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "DerogationStatus" AS ENUM ('PENDING', 'VALIDATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ValidatorRole" AS ENUM ('DEMANDEUR', 'RFR', 'CPR', 'OM', 'DP', 'CFO', 'CEO');

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "year" INTEGER,
    "site" TEXT,
    "sequentialNumber" TEXT,
    "project" TEXT,
    "region" TEXT,
    "projectCode" TEXT,
    "grantCode" TEXT,
    "activityCode" TEXT,
    "costCenter" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "marketType" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "operationType" "OperationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedDeliveryDate" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "validatedAt" TIMESTAMP(3),
    "processingDuration" INTEGER,
    "priority" TEXT,
    "deliveryAddress" TEXT,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'DRAFT',
    "currentStep" "PurchaseStep" NOT NULL DEFAULT 'DA',
    "observations" TEXT,
    "responsible" TEXT,
    "creatorId" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_items" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "specifications" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "type" "AttachmentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "description" TEXT,
    "uploadedBy" TEXT,
    "receivedAt" TIMESTAMP(3),
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "derogations" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "status" "DerogationStatus" NOT NULL DEFAULT 'PENDING',
    "validationLevel" INTEGER NOT NULL DEFAULT 0,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "derogations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_workflows" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "validation_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validators" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "userId" INTEGER,
    "role" "ValidatorRole" NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "isValidated" BOOLEAN NOT NULL DEFAULT false,
    "validatedAt" TIMESTAMP(3),
    "comment" TEXT,
    "decision" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "validators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchases_reference_key" ON "purchases"("reference");

-- CreateIndex
CREATE INDEX "purchases_reference_idx" ON "purchases"("reference");

-- CreateIndex
CREATE INDEX "purchases_status_idx" ON "purchases"("status");

-- CreateIndex
CREATE INDEX "purchases_currentStep_idx" ON "purchases"("currentStep");

-- CreateIndex
CREATE INDEX "purchases_project_idx" ON "purchases"("project");

-- CreateIndex
CREATE INDEX "purchases_region_idx" ON "purchases"("region");

-- CreateIndex
CREATE INDEX "purchases_creatorId_idx" ON "purchases"("creatorId");

-- CreateIndex
CREATE INDEX "purchases_createdAt_idx" ON "purchases"("createdAt");

-- CreateIndex
CREATE INDEX "purchase_items_purchaseId_idx" ON "purchase_items"("purchaseId");

-- CreateIndex
CREATE INDEX "attachments_purchaseId_idx" ON "attachments"("purchaseId");

-- CreateIndex
CREATE INDEX "attachments_type_idx" ON "attachments"("type");

-- CreateIndex
CREATE UNIQUE INDEX "derogations_purchaseId_key" ON "derogations"("purchaseId");

-- CreateIndex
CREATE INDEX "derogations_purchaseId_idx" ON "derogations"("purchaseId");

-- CreateIndex
CREATE INDEX "derogations_status_idx" ON "derogations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "validation_workflows_purchaseId_key" ON "validation_workflows"("purchaseId");

-- CreateIndex
CREATE INDEX "validation_workflows_purchaseId_idx" ON "validation_workflows"("purchaseId");

-- CreateIndex
CREATE INDEX "validators_workflowId_idx" ON "validators"("workflowId");

-- CreateIndex
CREATE INDEX "validators_userId_idx" ON "validators"("userId");

-- CreateIndex
CREATE INDEX "validators_order_idx" ON "validators"("order");

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "derogations" ADD CONSTRAINT "derogations_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_workflows" ADD CONSTRAINT "validation_workflows_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validators" ADD CONSTRAINT "validators_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "validation_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validators" ADD CONSTRAINT "validators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
