"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";

/**
 * 読み込み中に画面上部へ出す青いバー（WEBRISのイメージカラー）。
 *
 * ダッシュボードは WEBRIS の集計API・GA4・Search Console・Stripe を経由するため、
 * 期間やタブを切り替えた直後は見た目が変わらない時間がある。その間、進行中で
 * あることを上部のバーで示す。色は WEBRIS 側の #3D7EFF（globals.css の
 * .webris-loading-bar）で、HUB の青(--accent)とは区別している。
 */
export function TopLoadingBar({ show }: { show: boolean }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-x-0 top-0 z-[60] h-[4px] overflow-hidden transition-opacity duration-150 ${
        show ? "opacity-100 bg-[#3d7eff]/20" : "opacity-0"
      }`}
    >
      {show && <div className="webris-loading-bar h-full w-2/5" />}
    </div>
  );
}

function LinkPending() {
  const { pending } = useLinkStatus();
  return <TopLoadingBar show={pending} />;
}

/**
 * ダッシュボード内の遷移用リンク。クリックから描画までの間、上部バーを出す。
 * prefetch を切っているのは、prefetch 済みだと pending 状態が発生せず
 * バーが出ないため（どのみちこの画面のデータは都度サーバーで取得する）。
 */
export function DashLink({ children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link {...props} prefetch={false}>
      {children}
      <LinkPending />
    </Link>
  );
}
