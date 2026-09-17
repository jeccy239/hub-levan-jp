"use client";

import Link, { useLinkStatus } from "next/link";
import { useEffect, useSyncExternalStore, type ComponentProps } from "react";

/**
 * 読み込み中に画面上部へ出す青いバー（WEBRISのイメージカラー）。
 *
 * ダッシュボードは WEBRIS の集計API・GA4・Search Console・Stripe を経由するため、
 * 期間やタブを切り替えた直後は見た目が変わらない時間がある。その間、進行中で
 * あることを上部のバーで示す。色は WEBRIS 側の #3D7EFF（globals.css の
 * .webris-loading-bar）で、HUB の青(--accent)とは区別している。
 *
 * 読み込み中は左から少しずつ伸び（終わりが分からないので 90% 手前で減速）、
 * 終わったら右端まで伸びきってから消える。バー本体は layout.tsx に1つだけ置き、
 * 各リンク・フォームは <LoadingSignal> で「読み込み中」を知らせるだけにしている
 * （遷移でリンクが消えても完了アニメーションが途切れないようにするため）。
 */

type Phase = "idle" | "loading" | "done";
type BarState = { phase: Phase; progress: number };

const IDLE: BarState = { phase: "idle", progress: 0 };
let bar: BarState = IDLE;
let activeCount = 0;
let trickle: ReturnType<typeof setInterval> | undefined;
let reset: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit(next: BarState) {
  bar = next;
  listeners.forEach((l) => l());
}

function start() {
  clearTimeout(reset);
  // 0 から描画し、次のフレームで最初の一歩を出す（transition を効かせるため）
  emit({ phase: "loading", progress: 0 });
  requestAnimationFrame(() => {
    if (activeCount > 0) emit({ phase: "loading", progress: 0.15 });
  });
  trickle = setInterval(() => {
    emit({ phase: "loading", progress: bar.progress + (0.9 - bar.progress) * 0.1 });
  }, 250);
}

function finish() {
  clearInterval(trickle);
  emit({ phase: "done", progress: 1 });
  reset = setTimeout(() => emit(IDLE), 600);
}

function setActive(delta: number) {
  activeCount += delta;
  if (delta > 0 && activeCount === 1) start();
  if (delta < 0 && activeCount === 0) finish();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** show の間、上部バーを進行中にする（描画はしない）。 */
export function LoadingSignal({ show }: { show: boolean }) {
  useEffect(() => {
    if (!show) return;
    setActive(1);
    return () => setActive(-1);
  }, [show]);
  return null;
}

export function TopLoadingBar() {
  const { phase, progress } = useSyncExternalStore(
    subscribe,
    () => bar,
    () => IDLE,
  );

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] transition-opacity duration-300 ${
        phase === "loading" ? "opacity-100" : phase === "done" ? "opacity-0 delay-200" : "opacity-0"
      }`}
    >
      <div
        className={`webris-loading-bar h-full origin-left ${
          phase === "idle" ? "" : "transition-transform duration-200 ease-out"
        }`}
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}

function LinkPending() {
  const { pending } = useLinkStatus();
  return <LoadingSignal show={pending} />;
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
