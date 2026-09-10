-- CreateTable
CREATE TABLE "WebrisContractNotice" (
    "webrisOrgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailStatus" TEXT NOT NULL,

    CONSTRAINT "WebrisContractNotice_pkey" PRIMARY KEY ("webrisOrgId")
);
