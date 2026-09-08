-- Outbound mail can be authored as plain text or HTML
ALTER TABLE "OutreachMessage" ADD COLUMN "bodyFormat" TEXT NOT NULL DEFAULT 'text';
