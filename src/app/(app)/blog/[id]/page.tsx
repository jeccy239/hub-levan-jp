import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlogPost, BlogNotFoundError, BLOG_STATUS_LABEL } from "@/lib/webrisBlog";
import { WebrisApiError, WebrisNotConfiguredError } from "@/lib/webris";
import BlogForm from "../BlogForm";

export const dynamic = "force-dynamic";

export default async function EditBlogPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { created, saved } = await searchParams;

  let post;
  let error: string | null = null;
  try {
    post = await getBlogPost(id);
  } catch (e) {
    if (e instanceof BlogNotFoundError) notFound();
    error =
      e instanceof WebrisNotConfiguredError || e instanceof WebrisApiError
        ? e.message
        : "記事を取得できませんでした。";
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <Link href="/blog" className="text-sm text-[var(--accent)] hover:underline">
          ← WEBRIS ブログ
        </Link>
        <div className="mt-4 rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold-tint)] px-5 py-4 text-sm text-[var(--text)]">
          {error}
        </div>
      </div>
    );
  }

  if (!post) notFound();

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
      <div>
        <Link href="/blog" className="text-sm text-[var(--accent)] hover:underline">
          ← WEBRIS ブログ
        </Link>
        <div className="flex items-center gap-2 mt-2">
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text)]">記事を編集</h1>
          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-[var(--surface-2)] text-[var(--text-dim)]">
            {BLOG_STATUS_LABEL[post.status]}
          </span>
          {post.status === "published" && post.url && (
            <a href={post.url} target="_blank" rel="noreferrer" className="text-sm text-[var(--accent)] hover:underline">
              公開ページを開く ↗
            </a>
          )}
        </div>
      </div>

      {(created || saved) && (
        <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent-tint)] px-5 py-3 text-sm text-[var(--accent-strong)]">
          {created ? "記事を作成しました。" : "保存しました。"}
          {post.status === "published" && "公開ページへの反映まで最大2分かかります。"}
        </div>
      )}

      <BlogForm post={post} />
    </div>
  );
}
