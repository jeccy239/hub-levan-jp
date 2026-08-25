import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "LEVAN AI Business OS",
  description: "AI営業・SEO制作・レポート・アップセルを一つのデータ基盤でつなぐ業務OS",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--text)]">
        <header className="border-b border-[var(--line)] bg-[var(--surface)]/80 backdrop-blur-md sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-8">
            <Link href="/" className="font-semibold tracking-tight text-[var(--text)]">
              LEVAN <span className="text-[var(--text-dim)] font-normal">ビジネスOS</span>
            </Link>
            <nav className="flex gap-6 text-sm font-medium">
              <Link href="/" className="text-[var(--text-dim)] hover:text-[var(--text)]">
                ダッシュボード
              </Link>
              <Link href="/leads" className="text-[var(--text-dim)] hover:text-[var(--text)]">
                リード管理
              </Link>
              <Link href="/projects" className="text-[var(--text-dim)] hover:text-[var(--text)]">
                案件管理
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
