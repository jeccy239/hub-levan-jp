-- CreateTable
CREATE TABLE "WebrisAnalyticsCache" (
    "key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebrisAnalyticsCache_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "WebrisAdSpend" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "amountJpy" INTEGER NOT NULL,
    "memo" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebrisAdSpend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebrisAnalyticsCache_fetchedAt_idx" ON "WebrisAnalyticsCache"("fetchedAt");

-- CreateIndex
CREATE INDEX "WebrisAdSpend_periodStart_periodEnd_idx" ON "WebrisAdSpend"("periodStart", "periodEnd");
