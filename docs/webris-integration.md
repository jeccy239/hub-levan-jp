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
  // 任意。プロフィール画像URL。返せない場合は省略/null でよい
  // （LEVAN HUB側が頭文字アイコンにフォールバックする）。
  logoUrl?: string | null;        // 企業アカウントのロゴ画像URL
  ownerAvatarUrl?: string | null; // オーナー/担当者ユーザーのアバター画像URL
};
```

`logoUrl` / `ownerAvatarUrl` は公開URL（認証不要でGETできること）を返してください。
LEVAN HUBは素の `<img>` で読み込むため、画像ホストにCORS設定は不要ですが、
`Referrer-Policy` で弾かれない公開バケット等を推奨します。

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

## テスト用「シークレットプラン」（WEBRIS側の対応が必要）

LEVAN HUBの顧客詳細画面には「シークレットプランに変更」ボタンがある。これは
`POST /api/levanhub/organizations/{id}/plan` に `{ "planCode": "secret" }` を送るだけ。

現状のWEBRIS実装は、Stripeサブスクリプションが有効なOrganizationしかプラン変更
できない（`subscription.update` を呼ぶため）。シークレットプランは**未課金・解約済み
のOrganizationにこそ使いたい**ので、WEBRIS側で以下の特別扱いを実装してほしい:

- `planCode === "secret"` のときは **Stripeを一切呼ばず**、DBの
  `organization.planCode` を直接 `"secret"` に更新する（必要なら
  `subscriptionStatus` を `"active"` などテスト用の値にする）。
- `"secret"` から `"free"` へ戻すリクエスト（HUBの「通常プランに戻す」ボタン）も
  同様にStripe非経由でDB更新のみ。
- シークレットプランの内容（利用可能サイト数・キーワード上限など）はWEBRIS側で
  自由に定義してよい。顧客のプラン選択UIには出さないこと。

これが入るまでは、Freeや解約済みアカウントに対してボタンを押すと
「このOrganizationはStripe課金中ではないため…」というエラーがHUB画面に表示される。

## 契約増加のメール通知（HUB側のcronで実装済み）

新しい企業アカウント（＝契約）がWEBRISに増えたら、`email_info@levan.jp` へ
「○○○様が契約しました。」というメールを送る。

- 実装: [src/lib/webrisContractNotify.ts](../src/lib/webrisContractNotify.ts) /
  [src/app/api/cron/webris-contracts/route.ts](../src/app/api/cron/webris-contracts/route.ts)
- 仕組み: WEBRIS Webhookが無いため、HUBのcron（[vercel.json](../vercel.json)、15分間隔）が
  WEBRIS APIを叩き、HUB DBの `WebrisContractNotice` テーブルと差分を取って新規分だけ通知。
- **初回実行時**は既存の全Organizationを「通知済み」として取り込むだけでメールは送らない
  （一斉送信を防ぐ）。2回目以降に現れた企業アカウントが通知対象。
- 管理者アカウント（招待コード参加）は「契約」ではないので通知しない（行だけ作る）。
- メール送信は既存の Resend 連携（`RESEND_API_KEY` / `MAIL_FROM`）を使う。

### 必要な環境変数（Vercel / Production）

| 変数 | 用途 |
| --- | --- |
| `CRON_SECRET` | cronエンドポイントの認証。Vercelが `Authorization: Bearer <値>` を自動付与。**未設定だと401で通知が動かない。** |
| `WEBRIS_CONTRACT_NOTIFY_TO` | 通知先。省略時は `email_info@levan.jp` |
| `RESEND_API_KEY` / `MAIL_FROM` | 既存。メール配信 |

手動確認: `GET https://hub.levan.jp/api/cron/webris-contracts?key=<CRON_SECRET>`

## 将来の拡張候補

- プラン変更・強制解約などの書き込み操作（別エンドポイント、同じ認証方式）
- 決済手段の詳細表示（Stripeのpayment methodは機密性が高いため、下4桁とカードブランドだけを
  WEBRIS側のAPIで整形して返す設計にする。生のカード情報はLEVAN HUBに渡さない）
- Webhookベースのリアルタイム同期（契約開始・解約時にWEBRISからLEVAN HUBへプッシュ通知）
