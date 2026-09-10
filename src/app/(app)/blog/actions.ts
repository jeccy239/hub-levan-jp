"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireApprover } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import {
  BlogNotFoundError,
  createBlogPost,
  deleteBlogPost,
  updateBlogPost,
  type BlogPostInput,
  type BlogStatus,
} from "@/lib/webrisBlog";
import { WebrisApiError, WebrisNotConfiguredError } from "@/lib/webris";
import { uploadPublicImage } from "@/lib/blobUpload";

export type BlogFormState = { error?: string };

function errText(e: unknown): string {
  if (e instanceof WebrisNotConfiguredError || e instanceof WebrisApiError) return e.message;
  if (e instanceof BlogNotFoundError) return "対象の記事が見つかりません（削除済みの可能性）。";
  if (e instanceof Error) return e.message;
  return "処理に失敗しました。";
}

function readForm(formData: FormData): BlogPostInput {
  const s = (k: string) => String(formData.get(k) ?? "").trim();
  const status: BlogStatus = formData.get("status") === "published" ? "published" : "draft";
  const input: BlogPostInput = {
    title: s("title"),
    bodyMarkdown: s("bodyMarkdown"),
    status,
  };
  if (s("slug")) input.slug = s("slug");
  if (s("excerpt")) input.excerpt = s("excerpt");
  if (s("metaTitle")) input.metaTitle = s("metaTitle");
  if (s("metaDescription")) input.metaDescription = s("metaDescription");
  // 空文字は「画像を外す」の意図。キー自体は常に送る。
  input.coverImageUrl = s("coverImageUrl");
  return input;
}

function validate(input: BlogPostInput): string | null {
  if (!input.title) return "タイトルを入力してください。";
  if (!input.bodyMarkdown) return "本文を入力してください。";
  return null;
}

export async function createBlogPostAction(
  _prev: BlogFormState,
  formData: FormData,
): Promise<BlogFormState> {
  const user = await requireApprover();
  const input = readForm(formData);
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  let createdId: string;
  let createdStatus: BlogStatus;
  try {
    const created = await createBlogPost(input);
    createdId = created.id;
    createdStatus = created.status;
  } catch (e) {
    return { error: errText(e) };
  }

  await logAudit({
    userId: user.id,
    action: "blog.create",
    targetType: "webris_blog_post",
    targetId: createdId,
    detail: { title: input.title, status: createdStatus },
  });
  revalidatePath("/blog");
  redirect(`/blog/${createdId}?created=1`);
}

export async function updateBlogPostAction(
  _prev: BlogFormState,
  formData: FormData,
): Promise<BlogFormState> {
  const user = await requireApprover();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "記事IDがありません。" };
  const input = readForm(formData);
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  let status: BlogStatus;
  try {
    const updated = await updateBlogPost(id, input);
    status = updated.status;
  } catch (e) {
    return { error: errText(e) };
  }

  await logAudit({
    userId: user.id,
    action: "blog.update",
    targetType: "webris_blog_post",
    targetId: id,
    detail: { title: input.title, status },
  });
  revalidatePath("/blog");
  revalidatePath(`/blog/${id}`);
  redirect(`/blog/${id}?saved=1`);
}

/** 一覧からの下書き⇄公開のワンクリック切り替え。 */
export async function setBlogStatusAction(
  _prev: BlogFormState,
  formData: FormData,
): Promise<BlogFormState> {
  const user = await requireApprover();
  const id = String(formData.get("id") ?? "");
  const status: BlogStatus = formData.get("status") === "published" ? "published" : "draft";
  if (!id) return { error: "記事IDがありません。" };

  try {
    await updateBlogPost(id, { status });
  } catch (e) {
    return { error: errText(e) };
  }

  await logAudit({
    userId: user.id,
    action: status === "published" ? "blog.publish" : "blog.unpublish",
    targetType: "webris_blog_post",
    targetId: id,
    detail: { status },
  });
  revalidatePath("/blog");
  revalidatePath(`/blog/${id}`);
  return {};
}

export async function deleteBlogPostAction(
  _prev: BlogFormState,
  formData: FormData,
): Promise<BlogFormState> {
  const user = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "記事IDがありません。" };

  try {
    await deleteBlogPost(id);
  } catch (e) {
    return { error: errText(e) };
  }

  await logAudit({
    userId: user.id,
    action: "blog.delete",
    targetType: "webris_blog_post",
    targetId: id,
  });
  revalidatePath("/blog");
  redirect("/blog?deleted=1");
}

/** フォームからの画像アップロード。戻り値の url を coverImageUrl に入れる。 */
export async function uploadCoverImageAction(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireApprover();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "ファイルが選択されていません。" };
  }
  try {
    const { url } = await uploadPublicImage(file, "blog");
    return { ok: true, url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "アップロードに失敗しました。" };
  }
}
