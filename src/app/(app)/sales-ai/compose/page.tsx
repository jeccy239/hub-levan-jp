import Link from "next/link";
import { isEmailConfigured } from "@/lib/email";
import { getSenderName } from "@/lib/authz";
import { collectRecipients } from "@/lib/recipients";
import ComposeForm from "./ComposeForm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ComposePage() {
  const senderName = await getSenderName();
  const { recipients, unreachableCount, webrisError } = await collectRecipients();

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text)]">メール制作・配信</h1>
          <p className="text-[var(--text-dim)] mt-1 text-sm">
            見込み客・既存顧客・WEBRIS契約者・手入力アドレスへ、実データを差し込んだメールを送ります。
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
        recipients={recipients}
        emailConfigured={isEmailConfigured()}
        senderName={senderName}
        unreachableCount={unreachableCount}
        webrisError={webrisError}
      />
    </div>
  );
}
