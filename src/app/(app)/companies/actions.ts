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
