// 画像を Vercel Blob にアップロードして公開URLを返す。ブログのアイキャッチ
// 画像は WEBRIS 側に「公開URL」で渡す必要があるため、HUB がホストする。
//
// 必要な環境変数: BLOB_READ_WRITE_TOKEN（Vercel で Blob ストアを作成すると
// 自動で追加される）。未設定なら BlobNotConfiguredError。

import { put } from "@vercel/blob";

export class BlobNotConfiguredError extends Error {}

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function uploadPublicImage(
  file: File,
  prefix = "blog",
): Promise<{ url: string }> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new BlobNotConfiguredError(
      "画像アップロードが未設定です（BLOB_READ_WRITE_TOKEN）。Vercel で Blob ストアを作成してください。",
    );
  }
  if (!ALLOWED.includes(file.type)) {
    throw new Error("対応していない画像形式です（JPEG / PNG / WebP / GIF のみ）。");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("画像サイズが大きすぎます（8MBまで）。");
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const key = `${prefix}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const blob = await put(key, file, {
    access: "public",
    contentType: file.type,
    addRandomSuffix: false,
  });
  return { url: blob.url };
}
