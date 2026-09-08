import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
