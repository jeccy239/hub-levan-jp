"use client";

import { useActionState } from "react";
import { deleteBlogPostAction, setBlogStatusAction, type BlogFormState } from "./actions";
import type { BlogPostSummary } from "@/lib/webrisBlog";

export default function BlogRowActions({ post }: { post: BlogPostSummary }) {
  const [toggleState, toggle, toggling] = useActionState<BlogFormState, FormData>(
    setBlogStatusAction,
    {},
  );
  const [deleteState, remove, removing] = useActionState<BlogFormState, FormData>(
    deleteBlogPostAction,
    {},
  );

  const nextStatus = post.status === "published" ? "draft" : "published";
  const err = toggleState.error ?? deleteState.error;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <a
          href={`/blog/${post.id}`}
          className="text-[11px] font-semibold rounded-lg px-2.5 py-1 bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]"
        >
          編集
        </a>

        <form action={toggle}>
          <input type="hidden" name="id" value={post.id} />
          <input type="hidden" name="status" value={nextStatus} />
          <button
            type="submit"
            disabled={toggling}
            className="text-[11px] font-medium rounded-lg px-2.5 py-1 border border-[var(--line)] text-[var(--text)] hover:bg-[var(--surface-2)] disabled:opacity-40"
          >
            {toggling ? "…" : post.status === "published" ? "下書きに戻す" : "公開する"}
          </button>
        </form>

        {post.status === "published" && post.url && (
          <a
            href={post.url}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-medium rounded-lg px-2.5 py-1 border border-[var(--line)] text-[var(--text-dim)] hover:bg-[var(--surface-2)]"
          >
            表示 ↗
          </a>
        )}

        <form
          action={remove}
          onSubmit={(e) => {
            if (!confirm(`「${post.title}」を削除します。元に戻せません。よろしいですか？`)) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={post.id} />
          <button
            type="submit"
            disabled={removing}
            className="text-[11px] font-medium rounded-lg px-2.5 py-1 text-[var(--text-dim)] hover:text-[var(--danger)] disabled:opacity-40"
          >
            {removing ? "…" : "削除"}
          </button>
        </form>
      </div>
      {err && <span className="text-[11px] text-[var(--danger)]">{err}</span>}
    </div>
  );
}
