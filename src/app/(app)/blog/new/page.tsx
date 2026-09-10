import Link from "next/link";
import BlogForm from "../BlogForm";

export const dynamic = "force-dynamic";

export default function NewBlogPostPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
      <div>
        <Link href="/blog" className="text-sm text-[var(--accent)] hover:underline">
          ← WEBRIS ブログ
        </Link>
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text)] mt-2">記事を作成</h1>
      </div>
      <BlogForm />
    </div>
  );
}
