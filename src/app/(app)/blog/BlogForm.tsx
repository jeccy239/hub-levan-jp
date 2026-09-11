"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import {
  createBlogPostAction,
  updateBlogPostAction,
  uploadCoverImageAction,
  type BlogFormState,
} from "./actions";
import SeoChecklist, { buildChecks } from "./SeoChecklist";
import MarkdownGuide from "./MarkdownGuide";
import CtaButtonInserter from "./CtaButtonInserter";
import type { BlogEditorHandle } from "./BlogEditor";
import type { BlogPost, BlogStatus } from "@/lib/webrisBlog";

const BlogEditor = dynamic(() => import("./BlogEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] rounded-xl border border-[var(--line)] bg-[var(--surface-2)] flex items-center justify-center text-sm text-[var(--text-dim)]">
      エディタを読み込み中…
    </div>
  ),
});

const labelCls = "block text-xs font-medium text-[var(--text-dim)]";
const inputCls =
  "mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]";

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.set("file", file);
  const r = await uploadCoverImageAction(fd);
  if (!r.ok) throw new Error(r.error);
  return r.url;
}

export default function BlogForm({ post }: { post?: BlogPost }) {
  const isEdit = Boolean(post);
  const action = isEdit ? updateBlogPostAction : createBlogPostAction;
  const [state, formAction, isPending] = useActionState<BlogFormState, FormData>(action, {});

  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [category, setCategory] = useState(post?.category ?? "");
  const [body, setBody] = useState(post?.bodyMarkdown ?? "");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [metaTitle, setMetaTitle] = useState(post?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(post?.metaDescription ?? "");
  const [cover, setCover] = useState(post?.coverImageUrl ?? "");
  const [status, setStatus] = useState<BlogStatus>(post?.status ?? "draft");

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const editorHandleRef = useRef<BlogEditorHandle | null>(null);

  const checks = useMemo(
    () => buildChecks({ title, slug, metaTitle, metaDescription, excerpt, coverImageUrl: cover, body }),
    [title, slug, metaTitle, metaDescription, excerpt, cover, body],
  );

  function onPickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    startUpload(async () => {
      try {
        setCover(await uploadImage(file));
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "アップロードに失敗しました。");
      }
    });
  }

  return (
    <form action={formAction} className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
      {post && <input type="hidden" name="id" value={post.id} />}
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="bodyMarkdown" value={body} />
      <input type="hidden" name="excerpt" value={excerpt} />
      <input type="hidden" name="metaTitle" value={metaTitle} />
      <input type="hidden" name="metaDescription" value={metaDescription} />
      <input type="hidden" name="coverImageUrl" value={cover} />
      <input type="hidden" name="status" value={status} />

      {/* 左: タイトル + エディタ */}
      <div className="space-y-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="記事のタイトル"
          className="w-full bg-transparent text-[26px] font-semibold tracking-tight text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none"
        />
        <BlogEditor
          initialValue={post?.bodyMarkdown ?? ""}
          onChange={setBody}
          onUploadImage={uploadImage}
          onReady={(handle) => (editorHandleRef.current = handle)}
        />
        <p className="text-[11px] text-[var(--text-dim)]">
          ツールバーで見出し・リスト・表・画像を追加できます。画像はドラッグ＆ドロップや貼り付けでもアップロードされます。
          左下のタブで Markdown 直接編集に切り替え可能です。
        </p>
        <CtaButtonInserter getEditor={() => editorHandleRef.current} />
        <MarkdownGuide />
      </div>

      {/* 右: SEO + メタ + 公開 */}
      <div className="lg:sticky lg:top-6 space-y-4">
        <SeoChecklist checks={checks} />

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm p-5 space-y-4">
          <label className="block">
            <span className={labelCls}>カテゴリ</span>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              list="blog-category-suggestions"
              placeholder="未入力なら「記事」"
              className={inputCls}
            />
            <datalist id="blog-category-suggestions">
              <option value="お知らせ" />
              <option value="コラム" />
              <option value="事例" />
              <option value="アップデート" />
              <option value="SEO" />
            </datalist>
          </label>

          <label className="block">
            <span className={labelCls}>スラッグ（URL）</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="空欄でタイトルから自動生成"
              className={`${inputCls} font-mono`}
            />
            <span className="mt-1 block text-[11px] text-[var(--text-dim)]">
              webris.levan.jp/blog/<span className="font-mono">{slug || "（自動）"}</span>
            </span>
          </label>

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
              onChange={onPickCover}
              className="hidden"
            />
            {uploadError && <p className="mt-1.5 text-[11px] text-[var(--danger)]">{uploadError}</p>}
          </div>

          <label className="block">
            <span className={labelCls}>抜粋（一覧・OGP用）</span>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={3}
              placeholder="空欄で本文先頭から自動生成"
              className={inputCls}
            />
          </label>

          <label className="block">
            <span className={labelCls}>メタタイトル</span>
            <input
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              placeholder="空欄でタイトルを使用"
              className={inputCls}
            />
          </label>

          <label className="block">
            <span className={labelCls}>メタディスクリプション</span>
            <textarea
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
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
