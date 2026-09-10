// 顧客アカウントのプロフィールアイコン。画像URLが渡されればそれを、無ければ
// 名前の頭文字を使った色付きの丸を表示する（サーバーコンポーネント）。
// 外部（WEBRIS等）の任意オリジンの画像を扱うため next/image ではなく素の
// <img> を使う — 32px程度のアイコンに最適化は不要で、next.config の
// remotePatterns にWEBRIS側の保存先ドメインを結びつけずに済む。

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export default function Avatar({
  src,
  name,
  size = 32,
}: {
  src?: string | null;
  name: string | null | undefined;
  size?: number;
}) {
  const label = (name ?? "").trim();
  const initial = label ? [...label][0].toUpperCase() : "?";
  const hue = hashString(label || "?") % 360;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={label || "アカウント"}
        width={size}
        height={size}
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
