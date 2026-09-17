"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * 画面を開いている間、一定間隔でサーバーコンポーネントを再取得する。
 * タブが裏にある間は止め、表に戻ったときにすぐ1回取り直す。
 */
export function AutoRefresh({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, intervalMs]);
  return null;
}
