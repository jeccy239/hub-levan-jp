-- CreateEnum
CREATE TYPE "SendStatus" AS ENUM ('DRAFT', 'APPROVED', 'SENT');

-- CreateEnum
CREATE TYPE "UpsellStatus" AS ENUM ('PENDING', 'APPROVED', 'PRESENTED', 'REJECTED');

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" "SendStatus" NOT NULL DEFAULT 'DRAFT',
    "metricsJson" JSONB NOT NULL,
    "summaryText" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UpsellProposal" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "UpsellStatus" NOT NULL DEFAULT 'PENDING',
    "category" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UpsellProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Report_projectId_period_key" ON "Report"("projectId", "period");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpsellProposal" ADD CONSTRAINT "UpsellProposal_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
