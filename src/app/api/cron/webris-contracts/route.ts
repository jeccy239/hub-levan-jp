import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { runWebrisContractNotify } from "@/lib/webrisContractNotify";
import { WebrisApiError, WebrisNotConfiguredError } from "@/lib/webris";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron から定期実行される。Vercel は CRON_SECRET を設定していると
// Authorization: Bearer <CRON_SECRET> を付けてくるので、それを検証して
// 外部からの無断呼び出しを弾く。手動確認用に ?key=<CRON_SECRET> も許可。
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  if (req.nextUrl.searchParams.get("key") === secret) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runWebrisContractNotify();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message =
      e instanceof WebrisApiError || e instanceof WebrisNotConfiguredError
        ? e.message
        : e instanceof Error
          ? e.message
          : "unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
