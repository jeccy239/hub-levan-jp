"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition } from "react";
import { marked } from "marked";
import {
  createBlogPostAction,
  updateBlogPostAction,
  uploadCoverImageAction,
  type BlogFormState,
} from "./actions";
import type { BlogPost, BlogStatus } from "@/lib/webrisBlog";

marked.setOptions({ gfm: true, breaks: false });

const PREVIEW_STYLE = `
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.8;color:#111;padding:20px;max-width:720px;margin:0 auto}
    h1,h2,h3{line-height:1.35;margin:1.6em 0 .6em}
    h1{font-size:1.7em} h2{font-size:1.4em;border-bottom:1px solid #eee;padding-bottom:.2em} h3{font-size:1.15em}
    p{margin:1em 0} img{max-width:100%;height:auto;border-radius:8px}
    a{color:#0071e3} code{background:#f5f5f7;padding:.15em .4em;border-radius:4px;font-size:.9em}
    pre{background:#f5f5f7;padding:14px 16px;border-radius:8px;overflow:auto}
    pre code{background:none;padding:0}
    blockquote{border-left:3px solid #ddd;margin:1em 0;padding:.2em 0 .2em 1em;color:#555}
    table{border-collapse:collapse;width:100%;margin:1em 0}
    th,td{border:1px solid #ddd;padding:8px 10px;text-align:left}
    ul,ol{padding-left:1.4em}
  </style>
`;

const labelCls = "block text-xs font-medium text-[var(--text-dim)]";
const inputCls =
  "mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]";

export default function BlogForm({ post }: { post?: BlogPost }) {
  const isEdit = Boolean(post);
  const action = isEdit ? updateBlogPostAction : createBlogPostAction;
  const [state, formAction, isPending] = useActionState<BlogFormState, FormData>(action, {});

  const [body, setBody] = useState(post?.bodyMarkdown ?? "");
  const [cover, setCover] = useState(post?.coverImageUrl ?? "");
  const [status, setStatus] = useState<BlogStatus>(post?.status ?? "draft");
  const [showPreview, setShowPreview] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const rendered = marked.parse(body || "*本文を入力するとここにプレビューが出ます*", {
    async: false,
  }) as string;
  const previewHtml = `${PREVIEW_STYLE}${rendered}`;

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    const fd = new FormData();
    fd.set("file", file);
    startUpload(async () => {
      const r = await uploadCoverImageAction(fd);
      if (r.ok) setCover(r.url);
      else setUploadError(r.error);
    });
  }

  return (
    <form action={formAction} className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
      {post && <input type="hidden" name="id" value={post.id} />}
      <input type="hidden" name="coverImageUrl" value={cover} />
      <input type="hidden" name="status" value={status} />

      {/* 左: 本文 */}
      <div className="space-y-4">
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm p-5 space-y-4">
          <label className="block">
            <span className={labelCls}>タイトル</span>
            <input name="title" defaultValue={post?.title ?? ""} required className={inputCls} />
          </label>

          <label className="block">
            <span className={labelCls}>スラッグ（URL）</span>
            <input
              name="slug"
              defaultValue={post?.slug ?? ""}
              placeholder="空欄でタイトルから自動生成"
              className={`${inputCls} font-mono`}
            />
            <span className="mt-1 block text-[11px] text-[var(--text-dim)]">
              公開URL: webris.levan.jp/blog/<span className="font-mono">{post?.slug || "（自動）"}</span>
            </span>
          </label>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className={labelCls}>本文（Markdown）</span>
              <button
                type="button"
                onClick={() => setShowPreview((v) => !v)}
                className="text-[11px] font-medium text-[var(--accent)]"
              >
                {showPreview ? "エディタに戻る" : "プレビュー"}
              </button>
            </div>
            {showPreview ? (
              <iframe
                title="本文プレビュー"
                sandbox=""
                srcDoc={previewHtml}
                className="w-full h-[520px] rounded-xl border border-[var(--line)] bg-white"
              />
            ) : (
              <textarea
                name="bodyMarkdown"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={24}
                required
                placeholder={"## 見出し\n\n本文を Markdown で書きます。表・リスト・引用・コード・画像に対応しています。"}
                className={`${inputCls} font-mono text-[12px] leading-relaxed`}
              />
            )}
            <span className="mt-1 block text-[11px] text-[var(--text-dim)]">
              GFM（GitHub Flavored Markdown）。画像は <span className="font-mono">![alt](公開URL)</span> で挿入。
            </span>
          </div>
        </section>
      </div>

      {/* 右: メタ情報 + 公開設定 */}
      <div className="lg:sticky lg:top-6 space-y-4">
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm p-5 space-y-4">
          <div>
            <span className={labelCls}>アイキャッチ画像</span>
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover}
                alt="アイキャッチ"
                className="mt-1.5 w-full rounded-xl border border-[var(--line)] object-cover aspect-video bg-[var(--surface-2)]"
              />
            ) : (
              <div className="mt-1.5 w-full rounded-xl border border-dashed border-[var(--line)] aspect-video bg-[var(--surface-2)] flex items-center justify-center text-xs text-[var(--text-dim)]">
                画像なし
              </div>
            )}
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="text-xs font-medium px-3 py-1.5 rounded-full border border-[var(--line)] text-[var(--text)] hover:bg-[var(--surface-2)] disabled:opacity-40"
              >
                {uploading ? "アップロード中…" : cover ? "差し替え" : "画像をアップロード"}
              </button>
              {cover && (
                <button
                  type="button"
                  onClick={() => setCover("")}
                  className="text-xs font-medium text-[var(--text-dim)] hover:text-[var(--danger)]"
                >
                  外す
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={onPickFile}
              className="hidden"
            />
            {uploadError && <p className="mt-1.5 text-[11px] text-[var(--danger)]">{uploadError}</p>}
          </div>

          <label className="block">
            <span className={labelCls}>抜粋（一覧・OGP用）</span>
            <textarea
              name="excerpt"
              defaultValue={post?.excerpt ?? ""}
              rows={3}
              placeholder="空欄で本文先頭から自動生成"
              className={inputCls}
            />
          </label>

          <label className="block">
            <span className={labelCls}>メタタイトル</span>
            <input
              name="metaTitle"
              defaultValue={post?.metaTitle ?? ""}
              placeholder="空欄でタイトルを使用"
              className={inputCls}
            />
          </label>

          <label className="block">
            <span className={labelCls}>メタディスクリプション</span>
            <textarea
              name="metaDescription"
              defaultValue={post?.metaDescription ?? ""}
              rows={3}
              placeholder="空欄で抜粋を使用"
              className={inputCls}
            />
          </label>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm p-5 space-y-3">
          <span className={labelCls}>公開状態</span>
          <div className="inline-flex p-0.5 rounded-full bg-[var(--surface-2)]">
            {(["draft", "published"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatus(st)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  status === st ? "bg-[var(--surface)] text-[var(--text)] shadow-sm" : "text-[var(--text-dim)]"
                }`}
              >
                {st === "draft" ? "下書き" : "公開"}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[var(--text-dim)] leading-relaxed">
            {status === "published"
              ? "保存すると webris.levan.jp/blog に公開されます（反映まで最大2分）。"
              : "下書きは公開ページには表示されません。"}
          </p>

          {state.error && (
            <div className="rounded-xl bg-[var(--danger-tint)] px-3.5 py-2.5 text-xs text-[var(--danger)] leading-relaxed">
              {state.error}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={isPending || uploading}
              className="flex-1 text-sm font-medium px-4 py-2.5 rounded-full bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] transition-colors disabled:opacity-40"
            >
              {isPending
                ? "保存中…"
                : status === "published"
                  ? isEdit
                    ? "更新して公開"
                    : "公開する"
                  : isEdit
                    ? "更新"
                    : "下書き保存"}
            </button>
            <Link
              href={post ? `/blog/${post.id}` : "/blog"}
              className="text-sm font-medium px-4 py-2.5 rounded-full border border-[var(--line)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
            >
              キャンセル
            </Link>
          </div>
        </section>
      </div>
    </form>
  );
}
