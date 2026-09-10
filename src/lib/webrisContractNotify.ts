// WEBRIS で新しい契約（企業アカウント）が増えたら email_info@levan.jp へ
// 「○○○様が契約しました。」というメール通知を送る。
//
// WEBRIS からのリアルタイム Webhook はまだ無いので、HUB 側の cron が定期的に
// WEBRIS API を叩き、前回までに見たことのある Organization 一覧（HUB DB の
// WebrisContractNotice テーブル）と突き合わせて差分だけ通知する。

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { fetchWebrisOrganizations } from "@/lib/webris";

const NOTIFY_TO = process.env.WEBRIS_CONTRACT_NOTIFY_TO || "email_info@levan.jp";

export type NotifyRunResult = {
  checked: number;
  backfilled: number;
  notified: { webrisOrgId: string; name: string; emailStatus: string }[];
};

export async function runWebrisContractNotify(): Promise<NotifyRunResult> {
  const orgs = await fetchWebrisOrganizations();

  const known = await prisma.webrisContractNotice.findMany({ select: { webrisOrgId: true } });
  const knownIds = new Set(known.map((k) => k.webrisOrgId));

  // 初回実行（テーブルが空）は既存分を「通知済み扱い」で取り込むだけ。
  // ここでメールを送ると全顧客ぶんの通知が一斉に飛んでしまう。
  const firstRun = known.length === 0;

  const result: NotifyRunResult = { checked: orgs.length, backfilled: 0, notified: [] };

  for (const org of orgs) {
    if (knownIds.has(org.id)) continue;

    if (firstRun) {
      await prisma.webrisContractNotice.create({
        data: {
          webrisOrgId: org.id,
          name: org.name,
          accountType: org.accountType,
          emailStatus: "backfill",
        },
      });
      result.backfilled++;
      continue;
    }

    // 「契約」は企業アカウントのみ。管理者アカウントは招待コードでの参加なので
    // 通知対象外だが、再検知しないよう行だけは作る。
    let emailStatus: string;
    if (org.accountType !== "company") {
      emailStatus = "skipped:manager";
    } else {
      const sent = await sendEmail({
        to: NOTIFY_TO,
        subject: `【WEBRIS】${org.name}様が契約しました`,
        text: [
          `${org.name}様が契約しました。`,
          "",
          `会社名: ${org.name}`,
          `担当者: ${org.ownerName ?? "—"}（${org.ownerEmail}）`,
          `プラン: ${org.planName}`,
          `契約日: ${new Date(org.createdAt).toLocaleDateString("ja-JP")}`,
          "",
          `LEVAN HUB で見る: https://hub.levan.jp/webris/${org.id}`,
        ].join("\n"),
      });
      emailStatus = sent.delivered ? "delivered" : `failed:${sent.reason}`;
    }

    await prisma.webrisContractNotice.create({
      data: { webrisOrgId: org.id, name: org.name, accountType: org.accountType, emailStatus },
    });
    result.notified.push({ webrisOrgId: org.id, name: org.name, emailStatus });
  }

  return result;
}
