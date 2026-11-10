-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "freelancerName" TEXT NOT NULL,
    "repoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "deliverableUrl" TEXT,
    "orderId" TEXT,
    "authorizationId" TEXT,
    "captureId" TEXT,
    "capturedAmount" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_orderId_key" ON "Milestone"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_authorizationId_key" ON "Milestone"("authorizationId");

-- CreateIndex
CREATE INDEX "Milestone_dealId_idx" ON "Milestone"("dealId");

-- CreateIndex
CREATE INDEX "Review_milestoneId_idx" ON "Review"("milestoneId");

-- CreateIndex
CREATE INDEX "Event_milestoneId_idx" ON "Event"("milestoneId");

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

