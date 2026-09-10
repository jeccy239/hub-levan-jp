import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // ブログのアイキャッチ画像アップロード（Server Action 経由）用。
    // 既定1MBだと写真がすぐ超える。blobUpload.ts 側で8MBを上限にしている。
    serverActions: { bodySizeLimit: "10mb" },
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
