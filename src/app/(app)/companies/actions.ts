"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { logAudit } from "@/lib/audit";

export async function createCompany(formData: FormData) {
  const user = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("会社名は必須です");

  const website = String(formData.get("website") ?? "").trim();
  const industry = String(formData.get("industry") ?? "").trim() || null;
  const location = String(formData.get("location") ?? "").trim() || null;
  const leadSourceId = String(formData.get("leadSourceId") ?? "").trim() || null;
  const statusId = String(formData.get("statusId") ?? "").trim() || null;

  const company = await prisma.company.create({
    data: { name, website, industry, location, leadSourceId, statusId },
  });

  await logAudit({ userId: user.id, action: "company.create", targetType: "company", targetId: company.id });

  revalidatePath("/companies");
  redirect(`/companies/${company.id}`);
}

export async function updateCompany(formData: FormData) {
  const user = await requireUser();
  const companyId = String(formData.get("companyId") ?? "");
  if (!companyId) return;

  const data = {
    name: String(formData.get("name") ?? "").trim(),
    nameKana: String(formData.get("nameKana") ?? "").trim() || null,
    website: String(formData.get("website") ?? "").trim(),
    industry: String(formData.get("industry") ?? "").trim() || null,
    location: String(formData.get("location") ?? "").trim() || null,
    postalCode: String(formData.get("postalCode") ?? "").trim() || null,
    address: String(formData.get("address") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    instagramUrl: String(formData.get("instagramUrl") ?? "").trim() || null,
    employeeRange: String(formData.get("employeeRange") ?? "").trim() || null,
    revenueRange: String(formData.get("revenueRange") ?? "").trim() || null,
    note: String(formData.get("note") ?? "").trim() || null,
    leadSourceId: String(formData.get("leadSourceId") ?? "").trim() || null,
    statusId: String(formData.get("statusId") ?? "").trim() || null,
  };

  await prisma.company.update({ where: { id: companyId }, data });
  await logAudit({ userId: user.id, action: "company.update", targetType: "company", targetId: companyId });

  revalidatePath(`/companies/${companyId}`);
}

export async function addContact(formData: FormData) {
  const user = await requireUser();
  const companyId = String(formData.get("companyId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!companyId || !name) return;

  const contact = await prisma.contact.create({
    data: {
      companyId,
      name,
      department: String(formData.get("department") ?? "").trim() || null,
      title: String(formData.get("title") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      mobile: String(formData.get("mobile") ?? "").trim() || null,
      roleType: (String(formData.get("roleType") ?? "OTHER") as "DECISION_MAKER" | "OPERATIONAL" | "OTHER"),
    },
  });

  await logAudit({ userId: user.id, action: "contact.create", targetType: "contact", targetId: contact.id });
  revalidatePath(`/companies/${companyId}`);
}

export async function deleteContact(contactId: string, companyId: string) {
  const user = await requireUser();
  await prisma.contact.delete({ where: { id: contactId } });
  await logAudit({ userId: user.id, action: "contact.delete", targetType: "contact", targetId: contactId });
  revalidatePath(`/companies/${companyId}`);
}

export async function recordActivity(formData: FormData) {
  const user = await requireUser();
  const companyId = String(formData.get("companyId") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  if (!companyId || !content) return;

  const nextActionAtRaw = String(formData.get("nextActionAt") ?? "").trim();

  const activity = await prisma.activity.create({
    data: {
      companyId,
      userId: user.id,
      contactId: String(formData.get("contactId") ?? "").trim() || null,
      type: (String(formData.get("type") ?? "OTHER") as never),
      content,
      result: String(formData.get("result") ?? "").trim() || null,
      nextActionAt: nextActionAtRaw ? new Date(nextActionAtRaw) : null,
      nextActionNote: String(formData.get("nextActionNote") ?? "").trim() || null,
    },
  });

  await prisma.company.update({ where: { id: companyId }, data: { lastContactAt: new Date() } });
  await logAudit({ userId: user.id, action: "activity.create", targetType: "activity", targetId: activity.id });
  revalidatePath(`/companies/${companyId}`);
}

export async function createTask(formData: FormData) {
  const user = await requireUser();
  const companyId = String(formData.get("companyId") ?? "").trim() || null;
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const dueDateRaw = String(formData.get("dueDate") ?? "").trim();

  const task = await prisma.task.create({
    data: {
      companyId,
      title,
      assigneeId: String(formData.get("assigneeId") ?? "").trim() || user.id,
      priority: (String(formData.get("priority") ?? "MEDIUM") as never),
      dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
    },
  });

  await logAudit({ userId: user.id, action: "task.create", targetType: "task", targetId: task.id });
  revalidatePath(companyId ? `/companies/${companyId}` : "/tasks");
  revalidatePath("/tasks");
}

export async function updateTaskStatus(taskId: string, status: "TODO" | "DOING" | "DONE", companyId?: string) {
  const user = await requireUser();
  await prisma.task.update({ where: { id: taskId }, data: { status } });
  await logAudit({ userId: user.id, action: "task.status_change", targetType: "task", targetId: taskId, detail: { status } });
  if (companyId) revalidatePath(`/companies/${companyId}`);
  revalidatePath("/tasks");
}

export async function addTag(formData: FormData) {
  const user = await requireUser();
  const companyId = String(formData.get("companyId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!companyId || !name) return;

  const tag = await prisma.tag.upsert({ where: { name }, update: {}, create: { name } });
  await prisma.companyTag.upsert({
    where: { companyId_tagId: { companyId, tagId: tag.id } },
    update: {},
    create: { companyId, tagId: tag.id },
  });

  await logAudit({ userId: user.id, action: "tag.add", targetType: "company", targetId: companyId, detail: { tag: name } });
  revalidatePath(`/companies/${companyId}`);
}

export async function removeTag(companyId: string, tagId: string) {
  const user = await requireUser();
  await prisma.companyTag.delete({ where: { companyId_tagId: { companyId, tagId } } });
  await logAudit({ userId: user.id, action: "tag.remove", targetType: "company", targetId: companyId, detail: { tagId } });
  revalidatePath(`/companies/${companyId}`);
}

export async function addFile(formData: FormData) {
  const user = await requireUser();
  const companyId = String(formData.get("companyId") ?? "");
  const fileName = String(formData.get("fileName") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  if (!companyId || !fileName || !url) return;

  const file = await prisma.fileAsset.create({
    data: { companyId, fileName, url, uploadedById: user.id, note: String(formData.get("note") ?? "").trim() || null },
  });

  await logAudit({ userId: user.id, action: "file.add", targetType: "file_asset", targetId: file.id });
  revalidatePath(`/companies/${companyId}`);
}

export async function deleteFile(fileId: string, companyId: string) {
  const user = await requireUser();
  await prisma.fileAsset.delete({ where: { id: fileId } });
  await logAudit({ userId: user.id, action: "file.delete", targetType: "file_asset", targetId: fileId });
  revalidatePath(`/companies/${companyId}`);
}

export async function linkWebrisOrganization(formData: FormData) {
  const user = await requireUser();
  const companyId = String(formData.get("companyId") ?? "");
  const webrisOrganizationId = String(formData.get("webrisOrganizationId") ?? "");
  if (!companyId || !webrisOrganizationId) return;

  await prisma.company.update({
    where: { id: companyId },
    data: { webrisOrganizationId },
  });
  await logAudit({
    userId: user.id,
    action: "company.link_webris",
    targetType: "company",
    targetId: companyId,
    detail: { webrisOrganizationId },
  });
  revalidatePath(`/companies/${companyId}`);
}

export async function unlinkWebrisOrganization(companyId: string) {
  const user = await requireUser();
  await prisma.company.update({
    where: { id: companyId },
    data: { webrisOrganizationId: null },
  });
  await logAudit({ userId: user.id, action: "company.unlink_webris", targetType: "company", targetId: companyId });
  revalidatePath(`/companies/${companyId}`);
}
