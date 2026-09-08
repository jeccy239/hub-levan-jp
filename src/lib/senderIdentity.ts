// 特定電子メール法は、広告メールに送信者の氏名・名称と住所の表示を義務付け
// ている。テンプレートの {{company_address}} はここを差し込むので、実在の
// 住所であること。環境変数で上書きできるが、未設定でも法的要件を満たせる
// よう既定値を持たせている。

export const SENDER_COMPANY_NAME = process.env.SENDER_COMPANY_NAME ?? "株式会社LEVAN";

export const SENDER_COMPANY_ADDRESS =
  process.env.SENDER_COMPANY_ADDRESS ?? "〒454-0867 愛知県名古屋市中川区広田町2丁目71番地";

export const WEBRIS_PUBLIC_URL = process.env.WEBRIS_PUBLIC_URL ?? "https://webris.levan.jp";
