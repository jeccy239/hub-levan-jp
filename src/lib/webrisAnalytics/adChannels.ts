// 広告媒体の定義。クライアントコンポーネントからも読むため、DB依存を持たせない。
export const AD_CHANNELS = [
  { value: "instagram_paid", label: "Instagram広告" },
  { value: "google_ads", label: "Google広告" },
  { value: "other_paid", label: "その他広告" },
] as const;
export type AdChannel = (typeof AD_CHANNELS)[number]["value"];
export const AD_CHANNEL_LABEL: Record<string, string> = Object.fromEntries(AD_CHANNELS.map((c) => [c.value, c.label]));
