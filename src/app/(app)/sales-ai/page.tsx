import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { LeadStatus } from "@/generated/prisma/client";
import { fetchWebrisOrganizations } from "@/lib/webris";
import { LEAD_STATUS_LABEL } from "@/lib/labels";
import { isEmailConfigured } from "@/lib/email";
import ProspectingPanel from "./ProspectingPanel";
import LeadTable from "./LeadTable";
import Funnel from "./Funnel";

export const dynamic = "force-dynamic";
// リサーチ実行は 10社ぶんの外部サイト取得を伴うため、既定の実行時間では足りない
export const maxDuration = 60;

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start, end };
}

export default async function SalesAiPage() {
  const { start, end } = todayRange();

  const [scheduled, analyzed, mailed, opened, clicked, webrisOrgs, leads] = await Promise.all([
    prisma.lead.count({ where: { status: LeadStatus.QUALIFIED } }),
    prisma.lead.count({ where: { seoScore: { not: null } } }),
    prisma.outreachMessage.count({ where: { direction: "OUTBOUND", sentAt: { gte: start, lt: end } } }),
    prisma.outreachMessage.count({ where: { openedAt: { gte: start, lt: end } } }),
    prisma.outreachMessage.count({ where: { clickedAt: { gte: start, lt: end } } }),
    fetchWebrisOrganizations().catch(() => []),
    prisma.lead.findMany({
      where: { status: { in: [LeadStatus.QUALIFIED, LeadStatus.CONTACTED, LeadStatus.RESEARCHED] } },
      include: { company: { include: { contacts: { where: { email: { not: null } }, take: 1 } } } },
      orderBy: [{ potentialScore: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
  ]);

  const freeSignupsToday = webrisOrgs.filter(
    (o) => o.planCode === "free" && new Date(o.createdAt) >= start && new Date(o.createdAt) < end,
  ).length;
  const paidTotal = webrisOrgs.filter((o) => o.planCode !== "free").length;

  const rows = leads.map((l) => ({
    leadId: l.id,
    company: l.company.name,
    website: l.company.website,
    category: l.company.toolInterest,
    score: l.potentialScore,
    status: l.status,
    statusLabel: LEAD_STATUS_LABEL[l.status] ?? l.status,
    tools: Array.isArray(l.company.detectedTools) ? (l.company.detectedTools as string[]) : [],
    gapCount: Array.isArray(l.company.seoGaps) ? (l.company.seoGaps as string[]).length : 0,
    recipient: l.company.publicEmail ?? l.company.contacts[0]?.email ?? null,
    instagramUrl: l.company.instagramUrl,
  }));

  const sendableCount = rows.filter((r) => r.recipient).length;
  const setup = {
    gbiz: Boolean(process.env.GBIZINFO_API_TOKEN),
    email: isEmailConfigured(),
    llm: Boolean(process.env.ANTHROPIC_API_KEY),
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text)]">WEBRIS メール管理</h1>
          <p className="text-[var(--text-dim)] mt-1 text-sm max-w-xl">
            実在企業をgBizINFOから取得し、各社サイトを解析して導入ツールとSEOの弱点を突き止め、根拠のある営業メールを配信します。
          </p>
        </div>
        <Link
          href="/sales-ai/compose"
          className="shrink-0 whitespace-nowrap text-sm font-medium px-5 py-2.5 rounded-full bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] transition-colors shadow-sm"
        >
          メールを作成して配信
        </Link>
      </header>

      <SetupNotice setup={setup} />

      <Funnel
        stages={[
          // 分析完了 ⊇ 送信予定 ⊇ メール送信 ⊇ 開封 ⊇ クリック の包含関係になる
          // 順に並べる。この順序でないと転換率が100%を超えて意味をなさない。
          { label: "分析完了", value: analyzed, hint: "サイト解析とスコアリング済み" },
          { label: "送信予定", value: scheduled, hint: "営業対象と判定されたリード" },
          { label: "メール送信", value: mailed, hint: "本日送信した通数" },
          { label: "開封", value: opened, hint: "本日開封された通数" },
          { label: "クリック", value: clicked, hint: "本日クリックされた通数" },
        ]}
        outcomes={[
          { label: "Free登録", value: freeSignupsToday, hint: "本日のWEBRIS無料登録" },
          { label: "有料化", value: paidTotal, hint: "WEBRIS有料契約（累計）" },
        ]}
      />

      <ProspectingPanel />

      <LeadTable rows={rows} sendableCount={sendableCount} />
    </div>
  );
}

function SetupNotice({ setup }: { setup: { gbiz: boolean; email: boolean; llm: boolean } }) {
  const missing = [
    !setup.gbiz && {
      name: "gBizINFO APIトークン",
      why: "実在企業のリサーチに必要。これが無いと「リサーチ実行」は動きません。",
      how: "info.gbiz.go.jp/hojin/APIManual で無料申請",
      env: "GBIZINFO_API_TOKEN",
    },
    !setup.email && {
      name: "メール配信 (Resend)",
      why: "未設定の間、一斉配信はDB記録のみで実際には届きません。",
      how: "Resendでlevan.jpのドメイン認証後、APIキーを設定",
      env: "RESEND_API_KEY / MAIL_FROM",
    },
    !setup.llm && {
      name: "Anthropic APIキー",
      why: "未設定でも動作しますが、スコアと文面はサイト解析データからの機械算出になります。",
      how: "console.anthropic.com で発行",
      env: "ANTHROPIC_API_KEY",
    },
  ].filter(Boolean) as { name: string; why: string; how: string; env: string }[];

  if (missing.length === 0) return null;

  return (
    <section className="rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold-tint)] p-5">
      <h2 className="text-sm font-semibold text-[var(--text)]">
        セットアップが未完了です（{missing.length}件）
      </h2>
      <ul className="mt-3 space-y-2.5">
        {missing.map((m) => (
          <li key={m.env} className="text-sm">
            <div className="font-medium text-[var(--text)]">{m.name}</div>
            <div className="text-[var(--text-dim)] text-xs mt-0.5">
              {m.why} — {m.how}（環境変数 <code className="font-mono">{m.env}</code>）
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
