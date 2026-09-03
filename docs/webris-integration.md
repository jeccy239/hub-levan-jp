# WEBRIS ↔ LEVAN HUB 連携仕様

LEVAN HUB(`hub.levan.jp`)がWEBRIS(`webris.levan.jp`)の顧客(Organization)一覧を
表示するための連携。**WEBRISのDBにはLEVAN HUBから直接接続しない** — WEBRIS側に
認証付きの読み取り専用APIを1本追加し、LEVAN HUBがそれを呼び出す。

## 実装が必要な場所（WEBRIS側）

`webris.levan.jp` リポジトリに以下を追加してください。

### エンドポイント

```
GET /api/levanhub/organizations
```

### 認証

リクエストヘッダーの `Authorization: Bearer <secret>` を、環境変数
`LEVANHUB_WEBHOOK_SECRET`（既存の環境変数、`.env`に定義済み）の値と比較する。
一致しなければ `401` を返す。

```ts
// src/app/api/levanhub/organizations/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // WEBRIS側の既存のPrisma clientを想定

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.LEVANHUB_WEBHOOK_SECRET}`;
  if (!process.env.LEVANHUB_WEBHOOK_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const orgs = await prisma.organization.findMany({
    include: {
      users: { where: { role: "OWNER" }, include: { user: true }, take: 1 },
      ownedWebsites: { take: 1 },
    },
  });

  const plans = await prisma.plan.findMany();
  const planByCode = new Map(plans.map((p) => [p.code, p]));

  const payload = orgs.map((org) => {
    const owner = org.users[0]?.user;
    const plan = planByCode.get(org.planCode);
    return {
      id: org.id,
      name: org.name,
      websiteUrl: org.ownedWebsites[0]?.url ?? null, // フィールド名は実際のOwnedWebsiteモデルに合わせて調整
      planCode: org.planCode,
      planName: plan?.name ?? org.planCode,
      monthlyPriceJpy: plan?.monthlyPriceJpy ?? 0,
      subscriptionStatus: org.subscriptionStatus,
      currentPeriodEnd: org.currentPeriodEnd?.toISOString() ?? null,
      createdAt: org.createdAt.toISOString(),
      ownerName: owner?.name ?? null,
      ownerEmail: owner?.email ?? "",
    };
  });

  return NextResponse.json(payload);
}
```

上記は参考実装で、WEBRIS側の実際のモデル名・フィールド名（`OwnedWebsite`のURL
フィールド名など）に合わせて調整してください。

### レスポンス形式（LEVAN HUB側が期待する型）

```ts
type WebrisOrganization = {
  id: string;
  name: string;
  websiteUrl: string | null;
  planCode: string;
  planName: string;
  monthlyPriceJpy: number;
  subscriptionStatus: string | null; // active | trialing | past_due | canceled | incomplete | null
  currentPeriodEnd: string | null;   // ISO 8601
  createdAt: string;                 // ISO 8601（契約日として表示）
  ownerName: string | null;
  ownerEmail: string;
};
```

トップレベルはこの配列そのもの（`{ data: [...] }` のようなラップはしない）。

## 実装が必要な場所（LEVAN HUB側）— 実装済み

- [src/lib/webris.ts](../src/lib/webris.ts) — 上記APIを呼び出すクライアント
- [src/app/(app)/webris/page.tsx](../src/app/(app)/webris/page.tsx) — 顧客一覧画面
- 環境変数 `WEBRIS_API_URL` / `WEBRIS_API_SECRET`（`.env.example`参照）

## 設定手順

1. WEBRIS側に上記APIエンドポイントを実装・デプロイ
2. 共有シークレットを1つ決めて、以下2箇所に**同じ値**を設定:
   - WEBRIS: `LEVANHUB_WEBHOOK_SECRET`（Vercelの環境変数）
   - LEVAN HUB: `WEBRIS_API_SECRET`（Vercelの環境変数）
3. LEVAN HUBの `/webris` 画面でエラーが出なくなれば連携完了

## 将来の拡張候補

- プラン変更・強制解約などの書き込み操作（別エンドポイント、同じ認証方式）
- 決済手段の詳細表示（Stripeのpayment methodは機密性が高いため、下4桁とカードブランドだけを
  WEBRIS側のAPIで整形して返す設計にする。生のカード情報はLEVAN HUBに渡さない）
- Webhookベースのリアルタイム同期（契約開始・解約時にWEBRISからLEVAN HUBへプッシュ通知）
