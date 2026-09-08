export const VARIABLES = [
  { token: "{{company}}", label: "会社名" },
  { token: "{{website}}", label: "相手サイトURL" },
  { token: "{{tools}}", label: "導入済みツール" },
  { token: "{{seoGap}}", label: "SEO上の不足" },
  { token: "{{seoOpportunity}}", label: "改善提案文" },
  { token: "{{sender}}", label: "差出人名" },
  { token: "{{webris_url}}", label: "WEBRIS計測リンク" },
  { token: "{{company_address}}", label: "LEVANの住所（法定表示）" },
];

// テキストとHTMLで同じ4種類を用意する。名前と用途を揃えておかないと、
// 形式を切り替えたときに「さっきの文面が無い」ことになる。
export const TEMPLATE_NAMES = [
  "新規開拓（WEBRIS訴求）",
  "既存顧客へのお知らせ",
  "既存顧客への活用提案",
  "広告代理店向け（協業提案）",
] as const;

// ---------------------------------------------------------------------------
// プレーンテキスト版
// ---------------------------------------------------------------------------

const SIGNATURE =
  "――――――――――\n{{company_address}}\nWEBRIS {{sender}}\n配信停止をご希望の場合は、本メールにご返信いただければ以後お送りいたしません。";

export const PRESETS = [
  {
    name: TEMPLATE_NAMES[0],
    subject: "{{company}}様のSEOで1点気になった点があります",
    body:
      "{{company}} ご担当者様\n\n" +
      "突然のご連絡失礼いたします。株式会社LEVANの{{sender}}と申します。\n\n" +
      "貴社サイト（{{website}}）を拝見し、{{tools}}をお使いなのを確認しました。\n" +
      "一方で「{{seoGap}}」という点があり、{{seoOpportunity}}\n\n" +
      "計測環境が整っているぶん、「次に何を直すべきか」まで分かると運用が楽になるはずです。\n" +
      "弊社のAI SEOツール「WEBRIS」は、そこをAIが自動で洗い出します。無料で貴社サイトを分析できます。\n\n" +
      "▼ 無料でSEO分析する\n{{webris_url}}\n\n" +
      SIGNATURE,
  },
  {
    name: TEMPLATE_NAMES[1],
    subject: "【WEBRIS】{{company}}様へお知らせ",
    body:
      "{{company}} ご担当者様\n\n" +
      "いつもWEBRISをご利用いただきありがとうございます。株式会社LEVANの{{sender}}です。\n\n" +
      "（ここにお知らせ内容を記載してください）\n\n" +
      "ご不明な点がありましたら、本メールにご返信ください。\n引き続きよろしくお願いいたします。\n\n" +
      SIGNATURE,
  },
  {
    name: TEMPLATE_NAMES[2],
    subject: "{{company}}様、WEBRISの活用状況はいかがでしょうか",
    body:
      "{{company}} ご担当者様\n\n" +
      "いつもWEBRISをご利用いただきありがとうございます。株式会社LEVANの{{sender}}です。\n\n" +
      "その後、WEBRISはご活用いただけていますでしょうか。\n" +
      "「分析結果は見ているが、次の打ち手に迷っている」といったお声をいただくことがあり、\n" +
      "ご希望であれば30分ほどで使い方のご相談をお受けしています。\n\n" +
      "ご興味がありましたら、本メールにご返信ください。\n\n" +
      SIGNATURE,
  },
  {
    name: TEMPLATE_NAMES[3],
    subject: "{{company}}様｜クライアント様向けAI SEOツールのご案内",
    body:
      "{{company}} ご担当者様\n\n" +
      "株式会社LEVANの{{sender}}と申します。貴社の支援領域を拝見しご連絡いたしました。\n\n" +
      "弊社はAI SEOツール「WEBRIS」を開発しており、代理店様がクライアント様のサイト診断・" +
      "改善提案を行う際のツールとしてご利用いただくケースが増えています。\n\n" +
      "▼ 無料で試す\n{{webris_url}}\n\n" +
      SIGNATURE,
  },
];

// ---------------------------------------------------------------------------
// HTML版
//
// メールクライアントは <style> ブロックを落とすので、装飾はすべてインライン。
// 幅は600pxがメールの慣習。画像は絶対URLでしか読めない（相対パスは解決不能）。
// ---------------------------------------------------------------------------

export const IMAGE_BASE = "https://hub.levan.jp/mail";

const WRAP_OPEN =
  '<div style="font-family:sans-serif;font-size:14px;line-height:1.8;color:#111;max-width:600px">';
const WRAP_CLOSE = "</div>";

// 実ファイルを置くまでプレビューが壊れて見えるので、使い方はコメントで示す。
// public/mail/ に画像を置いてデプロイすれば、この1行を有効化するだけで使える。
const LOGO_HINT =
  '  <!-- ロゴを入れる場合はこの行を有効化: <img src="https://hub.levan.jp/mail/logo.png" alt="WEBRIS" width="160" style="display:block;margin-bottom:24px"> -->';

const button = (label: string) =>
  `  <p style="margin:28px 0">
    <a href="{{webris_url}}" style="background:#0071e3;color:#ffffff;padding:12px 24px;border-radius:24px;text-decoration:none;display:inline-block">${label}</a>
  </p>`;

const HTML_SIGNATURE = `  <hr style="border:none;border-top:1px solid #dddddd;margin:28px 0">
  <p style="font-size:12px;color:#666666;line-height:1.7">
    {{company_address}}<br>
    WEBRIS {{sender}}<br>
    配信停止をご希望の場合は、本メールにご返信いただければ以後お送りいたしません。
  </p>`;

export type MailTemplate = { name: string; subject: string; body: string };

export const HTML_PRESETS: MailTemplate[] = [
  {
    name: TEMPLATE_NAMES[0],
    subject: "{{company}}様のSEOで1点気になった点があります",
    body: `<div style="max-width:600px;margin:0 auto;font-family:sans-serif;color:#111111">

  <div style="background:#0071e3;padding:18px;text-align:center">
    <img src="${IMAGE_BASE}/logo.png" alt="WEBRIS" height="32" style="display:block;margin:0 auto;border:0">
  </div>

  <img src="${IMAGE_BASE}/hero.png" alt="AI SEO分析ツール WEBRIS" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0">

  <div style="padding:28px 24px;font-size:14px;line-height:1.9">

    <p>{{company}} ご担当者様</p>

    <p>突然のご連絡失礼いたします。株式会社LEVANの{{sender}}と申します。<br>
    貴社サイト（<a href="{{website}}" style="color:#0071e3">{{website}}</a>）を拝見してご連絡しました。</p>

    <div style="background:#e8f1fd;padding:18px 20px;margin:24px 0;line-height:1.9">
      <div style="font-weight:bold;margin-bottom:8px">拝見して気になった点</div>
      <div style="color:#d5372e;font-weight:bold;font-size:15px">{{seoGap}}</div>
      <div style="margin-top:8px;font-size:13px;color:#555555">{{seoOpportunity}}</div>
    </div>

    <p>{{tools}}をお使いなので計測環境は整っている一方、
    「<span style="font-weight:bold">次に何を直すべきか</span>」の判断は手間がかかる部分かと思います。</p>

    <p>弊社のAI SEOツール「WEBRIS」は、サイトを解析して優先度の高い改善点をAIが自動で洗い出します。
    貴社サイトをそのまま分析できますので、よろしければお試しください。</p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto">
      <tr><td style="background:#1d1d1f;border-radius:8px">
        <a href="{{webris_url}}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none">無料でSEO分析する</a>
      </td></tr>
    </table>

    <div style="background:#fbf8e8;padding:16px 20px;margin:24px 0;font-size:13px;line-height:1.9;color:#555555">
      ※ 無料プランでそのままご利用いただけます<br>
      ※ 分析だけのご利用でも問題ありません<br>
      ※ ご不要でしたら本メールへのご返信で配信を停止します
    </div>

    <hr style="border:none;border-top:1px solid #dddddd;margin:28px 0">
    <p style="font-size:12px;color:#666666;line-height:1.7">
      {{company_address}}<br>
      WEBRIS {{sender}}<br>
      配信停止をご希望の場合は、本メールにご返信いただければ以後お送りいたしません。
    </p>

  </div>
</div>`,
  },
  {
    name: TEMPLATE_NAMES[1],
    subject: "【WEBRIS】{{company}}様へお知らせ",
    body:
      "{{company}} ご担当者様\n\n" +
      "いつもWEBRISをご利用いただきありがとうございます。株式会社LEVANの{{sender}}です。\n\n" +
      "（ここにお知らせ内容を記載してください）\n\n" +
      "ご不明な点がありましたら、本メールにご返信ください。\n引き続きよろしくお願いいたします。\n\n" +
      SIGNATURE,
  },
  {
    name: TEMPLATE_NAMES[2],
    subject: "{{company}}様、WEBRISの活用状況はいかがでしょうか",
    body:
      "{{company}} ご担当者様\n\n" +
      "いつもWEBRISをご利用いただきありがとうございます。株式会社LEVANの{{sender}}です。\n\n" +
      "その後、WEBRISはご活用いただけていますでしょうか。\n" +
      "「分析結果は見ているが、次の打ち手に迷っている」といったお声をいただくことがあり、\n" +
      "ご希望であれば30分ほどで使い方のご相談をお受けしています。\n\n" +
      "ご興味がありましたら、本メールにご返信ください。\n\n" +
      SIGNATURE,
  },
  {
    name: TEMPLATE_NAMES[3],
    subject: "{{company}}様｜クライアント様向けAI SEOツールのご案内",
    body:
      "{{company}} ご担当者様\n\n" +
      "株式会社LEVANの{{sender}}と申します。貴社の支援領域を拝見しご連絡いたしました。\n\n" +
      "弊社はAI SEOツール「WEBRIS」を開発しており、代理店様がクライアント様のサイト診断・" +
      "改善提案を行う際のツールとしてご利用いただくケースが増えています。\n\n" +
      "▼ 無料で試す\n{{webris_url}}\n\n" +
      SIGNATURE,
  },
];


// ---------------------------------------------------------------------------
// HTMLパーツ。エディタに1クリックで差し込む断片。
//
// メールHTMLの制約に合わせてある:
//  - 装飾はインラインのみ（<style> は落とされる）
//  - 画像は絶対URL・width属性つき（Outlookは幅指定が無いと原寸で出す）
//  - 横並びは <table>（float/flexはメールソフトで崩れる）
//  - border-radius はOutlookでは効かないが、角丸が取れるだけで実害はない
// ---------------------------------------------------------------------------

export const HTML_SNIPPETS: { label: string; hint: string; code: string }[] = [
  {
    label: "ヘッダー",
    hint: "ブランドカラーの帯にロゴを置く（logo.png が必要）",
    code: `  <div style="background:#0071e3;padding:18px;text-align:center">
    <img src="${IMAGE_BASE}/logo.png" alt="WEBRIS" height="32" style="display:block;margin:0 auto;border:0">
  </div>`,
  },
  {
    label: "ヒーロー画像",
    hint: "横幅いっぱいのバナー（hero.png が必要・推奨1200px幅）",
    code: `  <img src="${IMAGE_BASE}/hero.png" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0">`,
  },
  {
    label: "見出し",
    hint: "セクション見出し",
    code: `  <h2 style="font-size:18px;font-weight:bold;margin:28px 0 12px">見出しを入力</h2>`,
  },
  {
    label: "強調テキスト",
    hint: "赤太字。訴求の要点に1箇所だけ使うと効く",
    code: `<span style="color:#d5372e;font-weight:bold">ここを強調</span>`,
  },
  {
    label: "注意書き",
    hint: "薄い背景の但し書きボックス",
    code: `  <div style="background:#fbf8e8;padding:16px 20px;margin:24px 0;font-size:13px;line-height:1.9;color:#555">
    ※ 注意事項を入力<br>
    ※ 注意事項を入力
  </div>`,
  },
  {
    label: "ボタン",
    hint: "中央寄せのCTA。クリック計測が付きます",
    code: `  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto">
    <tr><td style="background:#1d1d1f;border-radius:8px">
      <a href="{{webris_url}}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none">無料でSEO分析する</a>
    </td></tr>
  </table>`,
  },
  {
    label: "ボタン2つ",
    hint: "横並びのCTA。メールでは table でないと崩れます",
    code: `  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto">
    <tr>
      <td style="background:#1d1d1f;border-radius:8px">
        <a href="{{webris_url}}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none">無料でSEO分析する</a>
      </td>
      <td style="width:16px">&nbsp;</td>
      <td style="background:#1d1d1f;border-radius:8px">
        <a href="{{webris_url}}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none">詳しく見る</a>
      </td>
    </tr>
  </table>`,
  },
  {
    label: "区切り線",
    hint: "セクションの区切り",
    code: `  <hr style="border:none;border-top:1px solid #dddddd;margin:28px 0">`,
  },
];
