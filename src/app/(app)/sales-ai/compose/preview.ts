// 画面プレビュー用の差込。サーバ側 src/lib/mailTemplate.ts と同じ規則で
// 置換する。両者がずれると「見た文面と届く文面が違う」ことになるため、
// 規則を変えるときは必ず両方を直すこと。

const OPPORTUNITY_BY_GAP: Record<string, string> = {
  "meta descriptionが無い":
    "検索結果に出る説明文が自動生成に任されている状態で、クリック率を取りこぼしている可能性があります。",
  "構造化データ(JSON-LD)が無い":
    "検索エンジンや生成AIにページの内容が構造として伝わっておらず、リッチリザルトやAI検索での引用機会を逃している可能性があります。",
  "h1見出しが無い": "ページの主題が検索エンジンに伝わりにくく、評価が分散している可能性があります。",
  "titleタグが短い（15文字未満）":
    "titleに検索キーワードを含める余地が残っており、上位表示の機会を活かしきれていない可能性があります。",
  "titleタグが無い": "titleが未設定のため、検索結果での表示が不安定になっている可能性があります。",
  "canonicalタグが無い": "URLの重複がある場合に評価が分散し、本来の評価を受け取れていない可能性があります。",
  "OGP設定が無い": "SNSでシェアされた際に情報が正しく表示されず、流入機会を損ねている可能性があります。",
  "オウンドメディア/ブログ導線が見当たらない":
    "継続的に検索流入を集める入り口が不足しており、指名検索以外の接点が限られている可能性があります。",
};

type PreviewTarget = {
  name: string;
  website: string;
  tools: string[];
  seoGaps: string[];
} | null;

export function fillPreview(template: string, target: PreviewTarget, sender: string): string {
  const tools = target && target.tools.length > 0 ? target.tools.join("・") : "アクセス解析ツール";
  const gaps = target?.seoGaps ?? [];
  const seoGap = gaps.length > 0 ? gaps.slice(0, 2).join("・") : "コンテンツ更新頻度";
  const primary = gaps.find((g) => OPPORTUNITY_BY_GAP[g]);
  const opportunity = primary
    ? OPPORTUNITY_BY_GAP[primary]
    : gaps.length > 0
      ? `${gaps[0]}という点で改善の余地がありそうです。`
      : "サイト全体の構成を見直すことで、検索流入を伸ばせる可能性があります。";

  return template
    .replaceAll("{{company}}", target?.name ?? "サンプル株式会社")
    .replaceAll("{{website}}", target?.website || "https://example.co.jp")
    .replaceAll("{{tools}}", tools)
    .replaceAll("{{seoGap}}", seoGap)
    .replaceAll("{{seoOpportunity}}", opportunity)
    .replaceAll("{{sender}}", sender)
    .replaceAll("{{webris_url}}", "https://webris.levan.jp")
    .replaceAll("{{company_address}}", "株式会社LEVAN\n〒454-0867 愛知県名古屋市中川区広田町2丁目71番地");
}

export function unresolvedVariables(filled: string): string[] {
  return [...new Set(filled.match(/\{\{[^}\n]{1,40}\}\}/g) ?? [])];
}
