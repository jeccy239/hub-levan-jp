-- Outreach can now target a CRM company or a hand-entered address, not just a lead
ALTER TABLE "OutreachMessage" ALTER COLUMN "leadId" DROP NOT NULL;
ALTER TABLE "OutreachMessage" ADD COLUMN "companyId" TEXT;
ALTER TABLE "OutreachMessage" ADD COLUMN "toEmail" TEXT;
CREATE INDEX "OutreachMessage_companyId_idx" ON "OutreachMessage"("companyId");
ALTER TABLE "OutreachMessage" ADD CONSTRAINT "OutreachMessage_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
