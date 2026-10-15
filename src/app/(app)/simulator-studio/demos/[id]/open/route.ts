import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { simulatorDemoLoginUrl } from "@/lib/simulator-studio";

// 「管理画面を開く」：SimulatorStudio から2分だけ有効なログインURLをもらい、そこへ移動する（デモ店舗の管理画面にパスワードなしで入る）

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await ctx.params;
  let url: string;
  try {
    url = await simulatorDemoLoginUrl(id);
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "ログインURLを取得できませんでした。", { status: 502, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  redirect(url);
}
