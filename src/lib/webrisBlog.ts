// WEBRIS ブログ管理 API のクライアント。WEBRIS の DB には直接つながず、
// 認証付き API（/api/levanhub/blog）経由で記事を CRUD する。
// 契約は docs/webris-blog-integration.md を参照。

import { getWebrisConfig, WebrisApiError } from "@/lib/webris";

export type BlogStatus = "draft" | "published";

export type BlogPostSummary = {
  id: string;
  slug: string;
  title: string;
  status: BlogStatus;
  category: string | null;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  url: string | null;
};

export type BlogPost = BlogPostSummary & {
  bodyMarkdown: string;
  metaTitle: string | null;
  metaDescription: string | null;
};

export type BlogPostInput = {
  title: string;
  bodyMarkdown: string;
  slug?: string;
  category?: string;
  excerpt?: string;
  metaTitle?: string;
  metaDescription?: string;
  coverImageUrl?: string;
  status?: BlogStatus;
};

export class BlogNotFoundError extends Error {}

async function blogFetch(path: string, init?: RequestInit): Promise<unknown> {
  const { baseUrl, secret } = getWebrisConfig();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${secret}`,
      },
      cache: "no-store",
    });
  } catch {
    throw new WebrisApiError("WEBRISに接続できませんでした。ネットワークまたはURL設定を確認してください。");
  }

  if (response.status === 404) {
    // 呼び出し側で「記事なし」と「API未実装」を見分けたいので専用扱い。
    throw new BlogNotFoundError();
  }

  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    throw new WebrisApiError(body?.error ?? `WEBRISからエラーが返されました（HTTP ${response.status}）。`);
  }
  return body;
}

export async function listBlogPosts(status?: BlogStatus): Promise<BlogPostSummary[]> {
  const q = status ? `?status=${status}` : "";
  const body = await blogFetch(`/api/levanhub/blog${q}`);
  return Array.isArray(body) ? (body as BlogPostSummary[]) : [];
}

export async function getBlogPost(id: string): Promise<BlogPost> {
  return (await blogFetch(`/api/levanhub/blog/${id}`)) as BlogPost;
}

export async function createBlogPost(
  input: BlogPostInput,
): Promise<{ id: string; slug: string; status: BlogStatus; url: string | null }> {
  return (await blogFetch(`/api/levanhub/blog`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })) as { id: string; slug: string; status: BlogStatus; url: string | null };
}

export async function updateBlogPost(
  id: string,
  patch: Partial<BlogPostInput>,
): Promise<{ id: string; slug: string; status: BlogStatus; publishedAt: string | null; url: string | null }> {
  return (await blogFetch(`/api/levanhub/blog/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })) as { id: string; slug: string; status: BlogStatus; publishedAt: string | null; url: string | null };
}

export async function deleteBlogPost(id: string): Promise<void> {
  await blogFetch(`/api/levanhub/blog/${id}`, { method: "DELETE" });
}

export const BLOG_STATUS_LABEL: Record<BlogStatus, string> = {
  draft: "下書き",
  published: "公開中",
};
