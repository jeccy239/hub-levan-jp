import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { LeadStatus } from "@/generated/prisma/client";
import { isEmailConfigured } from "@/lib/email";
import { requireUser } from "@/lib/authz";
import ComposeForm from "./ComposeForm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ComposePage() {
  const user = await requireUser();
  const leads = await prisma.lead.findMany({
    where: { status: { in: [LeadStatus.RESEARCHED, LeadStatus.QUALIFIED, LeadStatus.CONTACTED] } },
    include: { company: { include: { contacts: { where: { email: { not: null } }, take: 1 } } } },
    orderBy: [{ potentialScore: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  const candidates = leads.map((l) => ({
    leadId: l.id,
    companyName: l.company.name,
    website: l.company.website,
    category: l.company.toolInterest,
    potentialScore: l.potentialScore,
    recipient: l.company.publicEmail ?? l.company.contacts[0]?.email ?? null,
    tools: Array.isArray(l.company.detectedTools) ? (l.company.detectedTools as string[]) : [],
    seoGaps: Array.isArray(l.company.seoGaps) ? (l.company.seoGaps as string[]) : [],
    alreadyContacted: l.status === LeadStatus.CONTACTED,
  }));

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text)]">メール制作・一斉配信</h1>
          <p className="text-[var(--text-dim)] mt-1 text-sm">
            サイト解析で得た実データを差し込んで、相手ごとに内容が変わる営業メールを作成します。
          </p>
        </div>
        <Link
          href="/sales-ai"
          className="shrink-0 text-sm font-medium px-4 py-2 rounded-full border border-[var(--line)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors whitespace-nowrap"
        >
          ダッシュボードへ戻る
        </Link>
      </header>

      <ComposeForm
        candidates={candidates}
        emailConfigured={isEmailConfigured()}
        senderName={user.name ?? user.email}
      />
    </div>
  );
}
