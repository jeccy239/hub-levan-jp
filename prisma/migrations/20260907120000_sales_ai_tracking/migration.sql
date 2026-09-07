-- WEBRIS SALES AI: engagement tracking + research targeting category
ALTER TABLE "OutreachMessage" ADD COLUMN "openedAt" TIMESTAMP(3);
ALTER TABLE "OutreachMessage" ADD COLUMN "clickedAt" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN "toolInterest" TEXT;
