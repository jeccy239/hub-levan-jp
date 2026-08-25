# LEVAN AI Business OS — Phase 1 MVP

企業リード登録 → Agent 01（SEO分析・見込みスコアリング）→ Agent 02（営業文生成）→ 人間承認 → 送信 → 返信管理、までを実装した最初のスライス。

## セットアップ

```bash
docker compose up -d      # ローカルPostgres
npm install
npx prisma migrate dev
npm run dev
```

`http://localhost:3000` — Dashboard / Leads 画面。

## AI APIキー

`.env` の `ANTHROPIC_API_KEY` を空のままにすると、各エージェントは決定論的なスタブ応答を返す（コストゼロでフロー全体を確認できる）。実際のLLM呼び出しを試す場合はキーを設定する。

## 構成

- `src/agents/` — Agent 01 (Lead Research, Level 3 自動) / Agent 02 (Sales, Level 1 承認制)
- `src/agents/decisionLog.ts` — 全エージェントの判断をAI Decision Logに記録
- `src/agents/llm.ts` — LLM呼び出しの一本化窓口（トークン・コスト計測）
- `prisma/schema.prisma` — Phase 1スキーマ（company/lead/outreach/decision log/cost ledger）
- `src/app/leads/` — Lead Management画面と承認フローのServer Actions

## 未実装（Phase 2以降）

商談・議事録・提案書・見積書・契約、SEO制作パイプライン、レポート、アップセル、認証/RBAC、外部API連携（GA4/GSC/CMS/Gmail）。設計書（Artifact）のセクションHのロードマップを参照。
