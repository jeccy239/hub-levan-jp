import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LEVAN AI Business OS",
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
