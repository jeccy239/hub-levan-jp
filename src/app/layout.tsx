import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LevanHub｜社内ビジネスツール 株式会社LEVAN",
  description: "AI営業・SEO制作・レポート・アップセルを一つのデータ基盤でつなぐ業務OS",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="h-full">{children}</body>
    </html>
  );
}
