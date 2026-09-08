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

const SIGNATURE = "――――――――――\n{{company_address}}\nWEBRIS {{sender}}\n配信停止をご希望の場合は、本メールにご返信いただければ以後お送りいたしません。";

export const PRESETS = [
  {
    name: "新規開拓（WEBRIS訴求）",
    subject: "{{company}}様のSEOで1点気になった点があります",
    body:
      "{{company}} ご担当者様\n\n" +
      "突然のご連絡失礼いたします。株式会社LEVANの{{sender}}と申します。\n\n" +
      "貴社サイト（{{website}}）を拝見し、{{tools}}をお使いなのを確認しました。\n" +
      "一方で「{{seoGap}}」という点があり、{{seoOpportunity}}\n\n" +
      "計測環境が整っているぶん、「次に何を直すべきか」まで分かると運用が楽になるはずです。\n" +
      "弊社のAI SEOツール「WEBRIS」は、そこをAIが自動で洗い出します。無料で貴社サイトを分析できます。\n\n" +
      "▼ 無料で試す\n{{webris_url}}\n\n" +
      SIGNATURE,
  },
  {
    name: "既存顧客へのお知らせ",
    subject: "【WEBRIS】{{company}}様へお知らせ",
    body:
      "{{company}} ご担当者様\n\n" +
      "いつもWEBRISをご利用いただきありがとうございます。株式会社LEVANの{{sender}}です。\n\n" +
      "（ここにお知らせ内容を記載してください）\n\n" +
      "ご不明な点がありましたら、本メールにご返信ください。\n引き続きよろしくお願いいたします。\n\n" +
      SIGNATURE,
  },
  {
    name: "既存顧客への活用提案",
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
    name: "広告代理店向け（協業提案）",
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
