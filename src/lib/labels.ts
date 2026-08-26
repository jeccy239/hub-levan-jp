export const LEAD_STATUS_LABEL: Record<string, string> = {
  NEW: "新規",
  RESEARCHED: "調査済み",
  QUALIFIED: "営業対象",
  CONTACTED: "接触済み",
  REPLIED: "返信あり",
  INTERESTED: "興味あり",
  MEETING: "商談中",
  PROPOSAL: "提案中",
  NEGOTIATION: "交渉中",
  WON: "成約",
  LOST: "失注",
};

export const APPROVAL_STATUS_LABEL: Record<string, string> = {
  PENDING: "承認待ち",
  APPROVED: "承認済み",
  REJECTED: "却下",
};

export const REPLY_CATEGORY_LABEL: Record<string, string> = {
  INTERESTED: "興味あり",
  NOT_INTERESTED: "興味なし",
  NEEDS_INFO: "追加情報が必要",
  UNSUBSCRIBE: "配信停止希望",
  OUT_OF_OFFICE: "不在返信",
  UNCLASSIFIED: "分類不能",
};

export const AGENT_NAME_LABEL: Record<string, string> = {
  lead_research_agent: "Agent 01・見込み調査",
  sales_agent: "Agent 02・営業",
  sales_research_agent: "Agent 03・商談準備",
  proposal_agent: "Agent 04・提案書",
  seo_strategy_agent: "Agent 06・SEO戦略",
  content_agent: "Agent 07・記事制作",
  quality_control_agent: "Agent 08・品質チェック",
  report_agent: "Agent 09・レポート",
  upsell_agent: "Agent 10・アップセル",
};

export const SEND_STATUS_LABEL: Record<string, string> = {
  DRAFT: "下書き",
  APPROVED: "承認済み",
  SENT: "送信済み",
};

export const UPSELL_STATUS_LABEL: Record<string, string> = {
  PENDING: "承認待ち",
  APPROVED: "承認済み・提案可",
  PRESENTED: "提案済み",
  REJECTED: "却下",
};

export const CONTENT_STATUS_LABEL: Record<string, string> = {
  KEYWORD: "キーワード計画",
  DRAFTED: "ドラフト作成済み",
  QC_REVIEWED: "品質チェック済み",
  HUMAN_REVIEW: "要人間レビュー",
  APPROVED: "承認済み・公開待ち",
  PUBLISHED: "公開済み",
};

export const CONTACT_ROLE_LABEL: Record<string, string> = {
  DECISION_MAKER: "決裁者",
  OPERATIONAL: "実務担当者",
  OTHER: "その他",
};

export const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  PHONE: "電話",
  EMAIL: "メール",
  ZOOM: "Zoom",
  VISIT: "対面",
  INQUIRY: "問い合わせ",
  PROPOSAL: "提案",
  QUOTE: "見積",
  CONTRACT: "契約",
  OTHER: "その他",
};

export const TASK_PRIORITY_LABEL: Record<string, string> = {
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高",
};

export const TASK_STATUS_LABEL: Record<string, string> = {
  TODO: "未着手",
  DOING: "対応中",
  DONE: "完了",
};

export function formatYen(amount: number | string): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return `¥${n.toLocaleString("ja-JP")}`;
}
