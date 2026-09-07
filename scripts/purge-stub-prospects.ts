// Usage: npx tsx scripts/purge-stub-prospects.ts [--delete]
//
// Lists (and with --delete, removes) the placeholder companies created by
// discoverProspectCompanies() while the agents were running in stub mode —
// they are identifiable by their example-prospect-N.jp website, which is a
// reserved example domain no real customer can have. Without --delete it
// only prints what it would remove.
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const STUB_WEBSITE_PREFIX = "https://example-prospect-";

async function main() {
  const apply = process.argv.includes("--delete");
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const targets = await prisma.company.findMany({
    where: { website: { startsWith: STUB_WEBSITE_PREFIX } },
    include: {
      lead: { include: { outreachMessages: true, meetings: true, proposals: true, contract: true } },
      customer: true,
      contacts: true,
      activities: true,
      tasks: true,
    },
  });

  console.log(`対象: ${targets.length}社 (website が ${STUB_WEBSITE_PREFIX}* のもの)\n`);
  for (const c of targets) {
    console.log(
      `  ${c.name}  ${c.website}\n` +
        `    lead=${c.lead ? c.lead.status : "なし"} ` +
        `送信済メール=${c.lead?.outreachMessages.filter((m) => m.sentAt).length ?? 0} ` +
        `商談=${c.lead?.meetings.length ?? 0} 提案=${c.lead?.proposals.length ?? 0} ` +
        `契約=${c.lead?.contract ? "あり" : "なし"} ` +
        `顧客化=${c.customer ? "あり" : "なし"} ` +
        `WEBRIS連携=${c.webrisOrganizationId ?? "なし"}`,
    );
  }

  // Refuse to touch anything that has picked up real business activity.
  const risky = targets.filter(
    (c) =>
      c.customer ||
      c.webrisOrganizationId ||
      c.lead?.contract ||
      (c.lead?.outreachMessages.some((m) => m.sentAt) ?? false),
  );
  if (risky.length > 0) {
    console.error(`\n中止: ${risky.length}社に実業務データ（契約/顧客/送信済メール/WEBRIS連携）があります。`);
    process.exit(1);
  }

  if (!apply) {
    console.log("\n（確認のみ。実際に削除するには --delete を付けて再実行）");
    await prisma.$disconnect();
    return;
  }

  const ids = targets.map((c) => c.id);
  const result = await prisma.company.deleteMany({ where: { id: { in: ids } } });
  console.log(`\n削除しました: ${result.count}社（Lead・下書きメールもカスケード削除）`);
  await prisma.$disconnect();
}

main();
