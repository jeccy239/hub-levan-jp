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
      "計測環境が整っているぶん、「次に何を直すべきか」まで分かると運用が楽になるはずです。\n\n" +
      "弊社のAI SEOツール「WEBRIS」は、SEO分析で現状を可視化し、競合サイトとの差を見つけ、\n" +
      "改善提案までAIが自動で行います。\n\n" +
      "またヒートマップ機能では、訪問者がどこを見てどこをクリックしているかを把握できます。\n" +
      "　・クリック数 — どこがよくクリックされているか\n" +
      "　・スクロール記録 — どこまで読まれているかを確認\n" +
      "　・平均スクロール深度 — ユーザーの閲覧傾向を分析\n" +
      "　・デバイス別 — PC・スマホの違いもチェック\n\n" +
      "「検索でどう見られているか」と「サイト上でどう動かれているか」を合わせて見ると、\n" +
      "直すべき箇所の優先順位がはっきりします。どちらも同じ画面で確認できます。\n\n" +
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

  <div style="background:#ffffff;padding:20px;text-align:center;border-bottom:1px solid #e5e5e7">
    <img src="${IMAGE_BASE}/logo_01.png" alt="WEBRIS" width="175" height="32" style="display:block;margin:0 auto;border:0">
  </div>

  <img src="${IMAGE_BASE}/hero_01.jpg" alt="AIが、あなたのWebサイトを分析しSEOの成長をサポートします" width="600" height="400" style="display:block;width:100%;max-width:600px;height:auto;border:0">

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

    <p>弊社のAI SEOツール「WEBRIS」は、<strong>SEO分析で現状を可視化</strong>し、
    <strong>競合サイトとの差</strong>を見つけ、<strong>改善提案</strong>までAIが自動で行います。</p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto">
      <tr><td style="background:#1d1d1f;border-radius:8px">
        <a href="{{webris_url}}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none">無料でSEO分析する</a>
      </td></tr>
    </table>

    <hr style="border:none;border-top:1px solid #dddddd;margin:32px 0">

    <p style="font-size:16px;font-weight:bold;margin:0 0 4px">ユーザーの動きも、同じ画面で見えます</p>
    <p style="margin-top:0">ヒートマップ機能で、訪問者が<strong>どこを見て、どこをクリックしているか</strong>をひと目で把握できます。</p>

    <img src="${IMAGE_BASE}/hero_02.jpg" alt="ヒートマップ機能で、ユーザーがどこを見てどこをクリックしているかをひと目で把握できます" width="552" height="368" style="display:block;width:100%;max-width:552px;height:auto;border:0;margin:20px 0">

    <div style="background:#f5f5f7;padding:18px 20px;margin:20px 0;font-size:13px;line-height:2">
      <strong>クリック数</strong> — どこがよくクリックされているか<br>
      <strong>スクロール記録</strong> — どこまで読まれているかを確認<br>
      <strong>平均スクロール深度</strong> — ユーザーの閲覧傾向を分析<br>
      <strong>デバイス別</strong> — PC・スマホの違いもチェック
    </div>

    <p>「検索でどう見られているか」と「サイト上でどう動かれているか」を合わせて見ると、
    直すべき箇所の優先順位がはっきりします。どちらも同じ画面で確認できます。</p>

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
    // hero_02 はヒートマップ訴求。宛先タブの「ヒートマップツール利用企業」に
    // 絞って送ると、バナーと相手の実態が噛み合う。
    name: "新規開拓（ヒートマップ訴求）",
    subject: "{{company}}様のサイト、ユーザーの動きは見えていますか",
    body: `<div style="max-width:600px;margin:0 auto;font-family:sans-serif;color:#111111">

  <div style="background:#ffffff;padding:20px;text-align:center;border-bottom:1px solid #e5e5e7">
    <img src="${IMAGE_BASE}/logo_01.png" alt="WEBRIS" width="175" height="32" style="display:block;margin:0 auto;border:0">
  </div>

  <img src="${IMAGE_BASE}/hero_02.jpg" alt="ヒートマップ機能で、ユーザーがどこを見てどこをクリックしているかをひと目で把握できます" width="600" height="400" style="display:block;width:100%;max-width:600px;height:auto;border:0">

  <div style="padding:28px 24px;font-size:14px;line-height:1.9">

    <p>{{company}} ご担当者様</p>

    <p>突然のご連絡失礼いたします。株式会社LEVANの{{sender}}と申します。<br>
    貴社サイト（<a href="{{website}}" style="color:#0071e3">{{website}}</a>）を拝見してご連絡しました。</p>

    <p>{{tools}}をお使いとのことで、ユーザー行動の計測にすでに取り組まれていると拝察しました。</p>

    <div style="background:#e8f1fd;padding:18px 20px;margin:24px 0;line-height:1.9">
      <div style="font-weight:bold;margin-bottom:8px">あわせて気になった点</div>
      <div style="color:#d5372e;font-weight:bold;font-size:15px">{{seoGap}}</div>
      <div style="margin-top:8px;font-size:13px;color:#555555">{{seoOpportunity}}</div>
    </div>

    <p>「どこがクリックされているか」に加えて「<span style="font-weight:bold">検索でどう見られているか</span>」まで
    ひとつの画面で見えると、改善の優先順位がつけやすくなります。</p>

    <p>WEBRISはヒートマップとSEO分析を同じ画面で確認でき、AIが改善点を自動で洗い出します。</p>

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
    code: `  <div style="background:#ffffff;padding:20px;text-align:center;border-bottom:1px solid #e5e5e7">
    <img src="${IMAGE_BASE}/logo_01.png" alt="WEBRIS" width="175" height="32" style="display:block;margin:0 auto;border:0">
  </div>`,
  },
  {
    label: "SEO分析バナー",
    hint: "hero_01 — AIがWebサイトを分析しSEOの成長をサポート",
    code: `  <img src="${IMAGE_BASE}/hero_01.jpg" alt="AIが、あなたのWebサイトを分析しSEOの成長をサポートします" width="600" height="400" style="display:block;width:100%;max-width:600px;height:auto;border:0">`,
  },
  {
    label: "ヒートマップバナー",
    hint: "hero_02 — ヒートマップでWebサイトの改善に活かす",
    code: `  <img src="${IMAGE_BASE}/hero_02.jpg" alt="ヒートマップ機能で、ユーザーがどこを見てどこをクリックしているかをひと目で把握できます" width="600" height="400" style="display:block;width:100%;max-width:600px;height:auto;border:0">`,
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
