-- Real prospecting: gBizINFO corporate identity + public site audit results
ALTER TABLE "Company" ADD COLUMN "corporateNumber" TEXT;
ALTER TABLE "Company" ADD COLUMN "publicEmail" TEXT;
ALTER TABLE "Company" ADD COLUMN "detectedTools" JSONB;
ALTER TABLE "Company" ADD COLUMN "seoGaps" JSONB;
ALTER TABLE "Company" ADD COLUMN "lastAuditedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Company_corporateNumber_key" ON "Company"("corporateNumber");
