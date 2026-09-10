import Link from "next/link";
import { listBlogPosts, BLOG_STATUS_LABEL, BlogNotFoundError, type BlogStatus } from "@/lib/webrisBlog";
import { WebrisApiError, WebrisNotConfiguredError } from "@/lib/webris";
import BlogRowActions from "./BlogRowActions";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<BlogStatus, string> = {
  draft: "bg-[var(--surface-2)] text-[var(--text-dim)]",
  published: "bg-[var(--accent-tint)] text-[var(--accent-strong)]",
};

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—";
}

export default async function BlogListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; deleted?: string }>;
}) {
  const params = await searchParams;
  const statusFilter: BlogStatus | undefined =
    params.status === "draft" || params.status === "published" ? params.status : undefined;

  let posts: Awaited<ReturnType<typeof listBlogPosts>> = [];
  let error: string | null = null;
  try {
    posts = await listBlogPosts(statusFilter);
  } catch (e) {
    if (e instanceof BlogNotFoundError) {
      error = "WEBRIS側にブログ連携API（/api/levanhub/blog）がまだ実装されていません。";
    } else if (e instanceof WebrisNotConfiguredError || e instanceof WebrisApiError) {
      error = e.message;
    } else {
      error = "記事一覧を取得できませんでした。";
    }
  }

  const tabs: { value: BlogStatus | undefined; label: string }[] = [
    { value: undefined, label: "すべて" },
    { value: "draft", label: "下書き" },
    { value: "published", label: "公開中" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text)]">WEBRIS ブログ</h1>
          <p className="text-[var(--text-dim)] mt-1 text-sm">
            webris.levan.jp/blog に載せる記事を作成・公開します。公開・更新後、最大2分で反映されます。
          </p>
        </div>
        <Link
          href="/blog/new"
          className="shrink-0 text-sm font-semibold px-4 py-2 rounded-full bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] transition-colors whitespace-nowrap"
        >
          新規作成
        </Link>
      </header>

      {params.deleted && (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] px-5 py-3 text-sm text-[var(--text-dim)]">
          記事を削除しました。
        </div>
      )}

      {error ? (
        <div className="rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold-tint)] px-5 py-4 text-sm text-[var(--text)]">
          {error}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            {tabs.map((t) => {
              const active = statusFilter === t.value;
              return (
                <Link
                  key={t.label}
                  href={t.value ? `/blog?status=${t.value}` : "/blog"}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    active
                      ? "bg-[var(--text)] text-white"
                      : "bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text)]"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm divide-y divide-[var(--line)]">
            {posts.map((post) => (
              <div key={post.id} className="flex items-center gap-4 px-5 py-3.5">
                {post.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.coverImageUrl}
                    alt=""
                    className="hidden sm:block w-20 h-12 rounded-lg object-cover border border-[var(--line)] bg-[var(--surface-2)] shrink-0"
                  />
                ) : (
                  <div className="hidden sm:block w-20 h-12 rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface-2)] shrink-0" />
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_BADGE[post.status]}`}
                    >
                      {BLOG_STATUS_LABEL[post.status]}
                    </span>
                    <Link
                      href={`/blog/${post.id}`}
                      className="text-sm font-medium text-[var(--text)] truncate hover:text-[var(--accent)]"
                    >
                      {post.title}
                    </Link>
                  </div>
                  <div className="text-[11px] text-[var(--text-dim)] mt-0.5 truncate">
                    <span className="font-mono">/{post.slug}</span>
                    {" ・ "}
                    更新 {fmtDate(post.updatedAt)}
                    {post.status === "published" && <> ・ 公開 {fmtDate(post.publishedAt)}</>}
                  </div>
                </div>

                <BlogRowActions post={post} />
              </div>
            ))}

            {posts.length === 0 && (
              <p className="px-5 py-12 text-center text-sm text-[var(--text-dim)]">
                {statusFilter ? "該当する記事がありません。" : "まだ記事がありません。「新規作成」から始めてください。"}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
