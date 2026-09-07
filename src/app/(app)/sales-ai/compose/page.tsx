import { prisma } from "@/lib/prisma";
import { LeadStatus } from "@/generated/prisma/client";
import ComposeForm from "./ComposeForm";

export const dynamic = "force-dynamic";

export default async function ComposePage() {
  const leads = await prisma.lead.findMany({
    where: { status: { in: [LeadStatus.NEW, LeadStatus.RESEARCHED, LeadStatus.QUALIFIED, LeadStatus.CONTACTED] } },
    include: { company: true },
    orderBy: { potentialScore: "desc" },
  });

  const candidates = leads.map((l) => ({
    leadId: l.id,
    companyName: l.company.name,
    toolInterest: l.company.toolInterest,
    potentialScore: l.potentialScore,
  }));

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text)]">メール作成・一斉配信</h1>
        <p className="text-[var(--text-dim)] mt-1">
          テンプレートには <code className="text-xs bg-[var(--surface-2)] px-1 py-0.5 rounded">{"{{company}}"}</code>{" "}
          が使えます（送信時に会社名へ置き換わります）。
        </p>
      </div>
      <ComposeForm candidates={candidates} />
    </div>
  );
}
