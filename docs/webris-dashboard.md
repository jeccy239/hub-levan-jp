# WEBRIS ダッシュボード（/webris/dashboard）

WEBRIS という SaaS 事業の状態（集客・プロダクト利用・課金・SEO）を1画面で判断するための画面。
サイドバー「WEBRIS（ウェブリス）> ダッシュボード」から開く。

## 構成

```
LEVAN HUB                                          WEBRIS (webris.levan.jp)
────────────────────────────────                   ────────────────────────────────────────
/webris/dashboard (Server Component)               GET /api/levanhub/analytics  ← 読み取り専用・Bearer認証
  └ WebrisService  ─── 取得 + DBキャッシュ ───────→   ├ WEBRIS DB（登録・URL登録・診断・AI実行・課金状態）
      (WebrisAnalyticsCache, 15分〜6時間)           ├ GA4 Data API（WEBRIS自身のサイトの連携トークン）
  └ AdsService     ─── 広告費（手入力）              ├ Search Console API（同上）
      (WebrisAdSpend)                               ├ Stripe（支払い済み請求書）
  └ metrics.ts     ─── KPI/流入元/ファネル/          ├ ヒートマップタグ（GA4未連携時の代替PV）
      ページ/SEO/イベント/アラートを純関数で計算     └ 競合監視（比較サイトの変更検知）
  └ aiSummary.ts   ─── ボタン押下時のみ Claude で要約
```

- HUB は WEBRIS の DB・Google・Stripe に直接つながない。トークンや鍵は WEBRIS のサーバー内に留まり、
  HUB には集計済みの数値だけが返る（氏名・メール・決済手段は返さない）。
- WEBRIS 側は外部 API の失敗をセクション単位で `status: "error"` にして返す。未連携は `not_connected`、
  Stripe キー未設定は `not_configured`。HUB はこれらを「取得エラー」「未計測」として表示し、0 と区別する。
- 画面を開くたびに外部 API を叩かないよう、期間ごとの応答を `WebrisAnalyticsCache` に保存する。
  直近を含む期間は15分、3日以上前に終わった期間は6時間で再取得。「最新に更新」で強制再取得。
  WEBRIS に届かない場合は前回の保存データを「前回取得分」と明示して表示する。

### ファイル

| 役割 | ファイル |
| --- | --- |
| 応答型 | `src/lib/webrisAnalytics/types.ts` |
| 期間（JST・プリセット・前期間/前年同期） | `src/lib/webrisAnalytics/range.ts` |
| WebrisService（取得・キャッシュ） | `src/lib/webrisAnalytics/webrisService.ts` |
| AdsService（広告費） | `src/lib/webrisAnalytics/adsService.ts` |
| 指標計算・流入元分類・ファネル・イベント定義・アラート | `src/lib/webrisAnalytics/metrics.ts` |
| AI 要約 | `src/lib/webrisAnalytics/aiSummary.ts` |
| 画面 | `src/app/(app)/webris/dashboard/`（タブごとに `tabs/*.tsx`） |
| WEBRIS 側の集計 | WEBRIS リポジトリ `src/lib/levanhub/business-analytics.ts`, `src/app/api/levanhub/analytics/route.ts` |
| 無料SEO診断の履歴 | HUB `src/lib/webrisAnalytics/publicScans.ts`, `tabs/ScansTab.tsx` / WEBRIS `src/app/api/public-scan/route.ts`（記録）, `src/app/api/levanhub/public-scans/route.ts` |

### SEO診断タブ（無料SEO診断の履歴）

webris.levan.jp の無料SEO診断（ログイン不要、`POST /api/public-scan`）で入力されたURLを新しい順に表示する。

- WEBRIS は診断のたびに `public_scan_logs`（`PublicScanLog`）へ URL・スコア・成否を保存する。IPは保存せず、
  `PV_EXCLUDE_IPS` に一致したものは `internal`（社内）として区別し、集計から除く。
- HUB は `GET /api/levanhub/public-scans?start&end&limit` を**キャッシュせず**に呼ぶ（`src/lib/webrisAnalytics/publicScans.ts`）。
  タブを開いている間は30秒ごとに再取得する（`AutoRefresh.tsx`、ブラウザのタブが裏にある間は停止）。
- 「7日間」などの期間は他のタブと同じく昨日までだが、このタブだけは今日の分まで含める。
- 診断URLのドメインを登録しているアカウントがあれば「登録済み」としてアカウント詳細へリンクする。

イベントを追加するときは `metrics.ts` の `EVENT_REGISTRY` に1行足す。流入元の分類ルールは `classifyChannel`。

## 指標の定義

| 指標 | 出典 | 定義 |
| --- | --- | --- |
| アクティブ/新規ユーザー・セッション・PV | GA4 | GA4 の同名指標 |
| リピーター | GA4 | `newVsReturning = returning` のアクティブユーザー |
| 平均エンゲージメント時間 | GA4 | `userEngagementDuration ÷ activeUsers`（GA4 UI と同じ） |
| 無料登録数 | WEBRIS DB | 期間内に作成された企業アカウント（WEBRIS 自身のサイトを登録したアカウントは除外） |
| URL登録数 | WEBRIS DB | 期間内に登録された OwnedWebsite |
| AI分析実行数 | WEBRIS DB | AIインサイト + AI記事 + SEO改善提案 + AIO表示チェック + ブランド露出チェック + AIOスコア |
| 有料ユーザー | WEBRIS DB | 現時点で有料プラン（free/secret 以外）かつ `active / trialing / past_due` |
| 売上 | Stripe | 期間内に支払い済みの請求書 `amount_paid` 合計（JPY のみ） |
| ARPU | Stripe | 売上 ÷ 期間内に支払いのあった顧客数 |
| CAC | 手入力 + WEBRIS DB | 広告費 ÷ 期間内の新規有料化（無料→有料のプラン変更） |
| CVR | GA4 + WEBRIS DB | 無料登録数 ÷ セッション |

ファネルの GA4 ステップは「期間中の全ユーザー」、WEBRIS DB ステップは「期間中に登録したアカウントが
現時点までに到達した数」。数え方が違うので、両者をまたぐ通過率は目安として表示している。

## 現時点で取得できないもの（画面では「—」「未計測」と表示）

| 項目 | 理由 / 必要な対応 |
| --- | --- |
| 流入元別の登録・URL登録・AI分析・課金 | WEBRIS が GA4 に `sign_up` / `url_add` / `ai_analysis_complete` / `purchase` を送っていない。WEBRIS 側で `gtag('event', …)` を実装すると自動で列が埋まる |
| CTAクリック・ログイン・決済開始（ファネル） | 同上（`cta_click` / `login` / `begin_checkout`） |
| ユーザーの初回訪問・流入元・閲覧ページ | WEBRIS が登録時の参照元を保存しておらず、GA4 もアカウントIDと紐づいていない |
| ページ別の出口数・離脱率 | GA4 Data API に指標が無い（代わりに直帰率を表示） |
| ページ別の売上 | 売上のページ帰属データが無い |
| 検索ボリューム | 外部キーワードツール未連携 |
| 広告費の自動取得 | Meta / Google 広告 API 未連携（流入元タブで手入力） |
| 競合のアクセス数 | 取得手段が無い（WEBRIS の競合監視による更新頻度のみ） |

## デプロイ手順

1. **WEBRIS**: `src/lib/levanhub/business-analytics.ts` と `src/app/api/levanhub/analytics/route.ts` をデプロイ。
   任意の環境変数 `WEBRIS_SELF_SITE_HOST`（既定 `webris.levan.jp`）。
2. **WEBRIS 上で、webris.levan.jp を登録したアカウントに GA4 と Search Console を連携**
   （顧客と同じ連携画面。Google へのログインと同意が必要なので人が行う）。未連携でも画面は動き、該当箇所が「未連携」になる。
3. **LEVAN HUB**: main へ push（Vercel のビルドで `prisma migrate deploy` が走り、
   `WebrisAnalyticsCache` / `WebrisAdSpend` テーブルが作られる）。新しい環境変数は不要
   （既存の `WEBRIS_API_URL` / `WEBRIS_API_SECRET` / `ANTHROPIC_API_KEY` を使う）。

WEBRIS 側が未デプロイの間、ダッシュボードは「WEBRIS側に集計API（/api/levanhub/analytics）がまだデプロイされていません。」と表示する。
