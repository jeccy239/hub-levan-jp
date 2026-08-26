// Usage: npx tsx scripts/seed-masters.ts
// Idempotent — safe to run multiple times (upserts by unique name).
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const STATUSES = [
  "リード",
  "見込み客",
  "商談中",
  "提案中",
  "契約済み",
  "継続顧客",
  "休眠",
  "失注",
  "対応終了",
];

const LEAD_SOURCES = [
  "Webサイト",
  "問い合わせフォーム",
  "電話",
  "紹介",
  "SNS",
  "広告",
  "展示会",
  "既存顧客",
  "アウトバウンド",
  "その他",
];

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  for (const [i, name] of STATUSES.entries()) {
    await prisma.companyStatus.upsert({
      where: { name },
      update: { order: i },
      create: { name, order: i, isDefault: i === 0 },
    });
  }

  for (const [i, name] of LEAD_SOURCES.entries()) {
    await prisma.leadSource.upsert({
      where: { name },
      update: { order: i },
      create: { name, order: i },
    });
  }

  console.log(`CompanyStatus: ${STATUSES.length}件, LeadSource: ${LEAD_SOURCES.length}件を登録/更新しました。`);
  await prisma.$disconnect();
}

main();
