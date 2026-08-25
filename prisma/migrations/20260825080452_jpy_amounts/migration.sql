/*
  Warnings:

  - You are about to drop the column `monthlyFeeUsd` on the `Contract` table. All the data in the column will be lost.
  - You are about to drop the column `amountUsd` on the `Proposal` table. All the data in the column will be lost.
  - Added the required column `monthlyFeeJpy` to the `Contract` table without a default value. This is not possible if the table is not empty.
  - Added the required column `amountJpy` to the `Proposal` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Contract" DROP COLUMN "monthlyFeeUsd",
ADD COLUMN     "monthlyFeeJpy" DECIMAL(12,0) NOT NULL;

-- AlterTable
ALTER TABLE "Proposal" DROP COLUMN "amountUsd",
ADD COLUMN     "amountJpy" DECIMAL(12,0) NOT NULL;
