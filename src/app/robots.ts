import type { MetadataRoute } from "next";

// 社内ツールのため、検索エンジンにはインデックスさせない。
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
