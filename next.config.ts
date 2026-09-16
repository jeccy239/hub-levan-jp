import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // ブログのアイキャッチ画像アップロード（Server Action 経由）用。
    // 既定1MBだと写真がすぐ超える。blobUpload.ts 側で8MBを上限にしている。
    serverActions: { bodySizeLimit: "10mb" },
    // Next 16.3 から既定で有効なビルド用ファイルシステムキャッシュを切る。
    // Vercel が復元したキャッシュから、新しいクラスを含まない古い Tailwind CSS が
    // 使われ、本番だけレイアウトが崩れた（2026-09-17）。
    turbopackFileSystemCacheForBuild: false,
  },
  // 社内ツールのため、全ページに X-Robots-Tag を付けて検索エンジンからの
  // インデックスを確実に防ぐ（layout.tsx の robots メタデータの保険）。
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
