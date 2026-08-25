-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('KEYWORD', 'DRAFTED', 'QC_REVIEWED', 'HUMAN_REVIEW', 'APPROVED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'KEYWORD',
    "keyword" TEXT NOT NULL,
    "searchIntent" TEXT,
    "priority" INTEGER,
    "title" TEXT,
    "outlineJson" JSONB,
    "draftBody" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "internalLinkCandidates" JSONB,
    "cta" TEXT,
    "qcScore" INTEGER,
    "qcIssues" JSONB,
    "ymylFlag" BOOLEAN NOT NULL DEFAULT false,
    "publishedUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_customerId_key" ON "Project"("customerId");

-- CreateIndex
CREATE INDEX "ContentItem_projectId_idx" ON "ContentItem"("projectId");

-- CreateIndex
CREATE INDEX "ContentItem_status_idx" ON "ContentItem"("status");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
