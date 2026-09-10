"use client";

import { useEffect, useRef, useState } from "react";

// 顧客アカウントのプロフィールアイコン。候補URLを順に試し（WEBRISのロゴ →
// サイトのfavicon / Gravatar など）、すべて読み込めなければ名前の頭文字を
// 使った色付きの丸を表示する。外部の任意オリジンの画像を扱うため
// next/image ではなく素の <img> を使う。
//
// SSRで既に404済みの<img>は、ハイドレーション後に onError を再発火しない
// ため、マウント時に complete && naturalWidth===0 を見て自前でフォール
// バックを進める。

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export default function Avatar({
  srcs,
  name,
  size = 28,
}: {
  srcs?: (string | null | undefined)[];
  name: string | null | undefined;
  size?: number;
}) {
  const candidates = (srcs ?? []).filter((s): s is string => Boolean(s));
  const [failed, setFailed] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  const label = (name ?? "").trim();
  const initial = label ? [...label][0].toUpperCase() : "?";
  const hue = hashString(label || "?") % 360;
  const src = candidates[failed];

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) {
      setFailed((n) => n + 1);
    }
  }, [src]);

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={src}
        ref={imgRef}
        src={src}
        alt={label || "アカウント"}
        width={size}
        height={size}
        onError={() => setFailed((n) => n + 1)}
        className="shrink-0 rounded-full object-cover bg-[var(--surface-2)] border border-[var(--line)]"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className="shrink-0 inline-flex items-center justify-center rounded-full font-semibold text-white select-none"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        backgroundColor: `hsl(${hue} 42% 55%)`,
      }}
    >
      {initial}
    </span>
  );
}
