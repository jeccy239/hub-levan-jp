import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const notoSansJp = Noto_Sans_JP({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "LEVAN AI Business OS",
  description: "AI営業・SEO制作・レポート・アップセルを一つのデータ基盤でつなぐ業務OS",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${notoSansJp.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--text)]">
        <header className="border-b border-[var(--line)]">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-8">
            <Link href="/" className="font-bold tracking-tight text-[var(--accent-strong)]">
              LEVAN <span className="text-[var(--text-dim)] font-normal">Business OS</span>
            </Link>
            <nav className="flex gap-6 text-sm">
              <Link href="/" className="hover:text-[var(--accent)]">
                Dashboard
              </Link>
              <Link href="/leads" className="hover:text-[var(--accent)]">
                Leads
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
