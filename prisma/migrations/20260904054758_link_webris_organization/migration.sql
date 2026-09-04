-- AlterTable
ALTER TABLE "Company" ADD COLUMN "webrisOrganizationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Company_webrisOrganizationId_key" ON "Company"("webrisOrganizationId");
