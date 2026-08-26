import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { addContact, deleteContact, updateCompany } from "../actions";
import { CONTACT_ROLE_LABEL, LEAD_STATUS_LABEL, formatYen } from "@/lib/labels";

export const dynamic = "force-dynamic";

const inputClass =
  "border border-[var(--line)] rounded-xl px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text)] placeholder:text-[var(--text-dim)]";
const card = "border border-[var(--line)] rounded-2xl p-5 bg-[var(--surface)] shadow-sm";
const primaryButton =
  "text-sm bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white rounded-xl px-4 py-2 font-medium shadow-sm";
const linkButton =
  "text-xs font-medium rounded-full px-3 py-1 text-[var(--danger)] hover:bg-[var(--danger-tint)]";

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [company, statuses, leadSources] = await Promise.all([
    prisma.company.findUnique({
      where: { id },
      include: {
        status: true,
        leadSource: true,
        contacts: { orderBy: { createdAt: "asc" } },
        lead: true,
        customer: {
          include: {
            contracts: { orderBy: { createdAt: "desc" } },
            project: true,
          },
        },
      },
    }),
    prisma.companyStatus.findMany({ orderBy: { order: "asc" } }),
    prisma.leadSource.findMany({ orderBy: { order: "asc" } }),
  ]);

  if (!company) notFound();

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      <div className="flex items-start justify-between gap-6 border-b border-[var(--line)] pb-6">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-[var(--text)]">{company.name}</h1>
          {company.website && <p className="text-[var(--text-dim)]">{company.website}</p>}
        </div>
        {company.status && (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-[var(--accent-tint)] text-[var(--accent-strong)]">
            {company.status.name}
          </span>
        )}
      </div>

      {/* 関連情報：既存の営業パイプライン／案件へのリンク */}
      {(company.lead || company.customer) && (
        <section className={`${card} space-y-2`}>
          <h2 className="font-semibold text-[var(--text)] mb-1">関連情報</h2>
          {company.lead && (
            <div className="text-sm text-[var(--text)]">
              営業パイプライン:{" "}
              <Link href={`/leads/${company.lead.id}`} className="text-[var(--accent)] hover:underline">
                {LEAD_STATUS_LABEL[company.lead.status] ?? company.lead.status}
              </Link>
              {company.lead.potentialScore !== null && ` （見込み度 ${company.lead.potentialScore}点）`}
            </div>
          )}
          {company.customer?.contracts[0] && (
            <div className="text-sm text-[var(--text)]">
              契約: {company.customer.contracts[0].plan}（月額
              {formatYen(company.customer.contracts[0].monthlyFeeJpy.toString())}）
            </div>
          )}
          {company.customer?.project && (
            <div className="text-sm">
              <Link href={`/projects/${company.customer.project.id}`} className="text-[var(--accent)] hover:underline">
                SEO制作案件を見る →
              </Link>
            </div>
          )}
        </section>
      )}

      {/* 会社情報 */}
      <section className={`${card} space-y-4`}>
        <h2 className="font-semibold text-[var(--text)]">会社情報</h2>
        <form action={updateCompany} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input type="hidden" name="companyId" value={company.id} />
          <label className="text-xs text-[var(--text-dim)] sm:col-span-2">
            会社名
            <input name="name" defaultValue={company.name} required className={`mt-1 w-full ${inputClass}`} />
          </label>
          <label className="text-xs text-[var(--text-dim)]">
            会社名カナ
            <input name="nameKana" defaultValue={company.nameKana ?? ""} className={`mt-1 w-full ${inputClass}`} />
          </label>
          <label className="text-xs text-[var(--text-dim)]">
            Webサイト
            <input name="website" defaultValue={company.website} className={`mt-1 w-full ${inputClass}`} />
          </label>
          <label className="text-xs text-[var(--text-dim)]">
            業種
            <input name="industry" defaultValue={company.industry ?? ""} className={`mt-1 w-full ${inputClass}`} />
          </label>
          <label className="text-xs text-[var(--text-dim)]">
            従業員規模
            <input name="employeeRange" defaultValue={company.employeeRange ?? ""} className={`mt-1 w-full ${inputClass}`} />
          </label>
          <label className="text-xs text-[var(--text-dim)]">
            売上規模
            <input name="revenueRange" defaultValue={company.revenueRange ?? ""} className={`mt-1 w-full ${inputClass}`} />
          </label>
          <label className="text-xs text-[var(--text-dim)]">
            電話番号
            <input name="phone" defaultValue={company.phone ?? ""} className={`mt-1 w-full ${inputClass}`} />
          </label>
          <label className="text-xs text-[var(--text-dim)]">
            郵便番号
            <input name="postalCode" defaultValue={company.postalCode ?? ""} className={`mt-1 w-full ${inputClass}`} />
          </label>
          <label className="text-xs text-[var(--text-dim)] sm:col-span-2">
            住所
            <input name="address" defaultValue={company.address ?? ""} className={`mt-1 w-full ${inputClass}`} />
          </label>
          <label className="text-xs text-[var(--text-dim)] sm:col-span-2">
            所在地（簡易）
            <input name="location" defaultValue={company.location ?? ""} className={`mt-1 w-full ${inputClass}`} />
          </label>
          <label className="text-xs text-[var(--text-dim)]">
            顧客ステータス
            <select name="statusId" defaultValue={company.statusId ?? ""} className={`mt-1 w-full ${inputClass}`}>
              <option value="">未設定</option>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-[var(--text-dim)]">
            流入経路
            <select name="leadSourceId" defaultValue={company.leadSourceId ?? ""} className={`mt-1 w-full ${inputClass}`}>
              <option value="">未設定</option>
              {leadSources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-[var(--text-dim)] sm:col-span-2">
            メモ
            <textarea name="note" defaultValue={company.note ?? ""} rows={3} className={`mt-1 w-full ${inputClass}`} />
          </label>
          <button type="submit" className={`sm:col-span-2 justify-self-start ${primaryButton}`}>
            保存
          </button>
        </form>
      </section>

      {/* 担当者 */}
      <section className={`${card} space-y-4`}>
        <h2 className="font-semibold text-[var(--text)]">担当者</h2>
        <div className="space-y-3">
          {company.contacts.map((contact) => (
            <div key={contact.id} className="border border-[var(--line)] rounded-xl p-4 flex items-start justify-between gap-4">
              <div className="text-sm text-[var(--text)]">
                <div className="font-medium">
                  {contact.name}
                  {contact.title && <span className="text-[var(--text-dim)] ml-2">{contact.title}</span>}
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--text-dim)]">
                    {CONTACT_ROLE_LABEL[contact.roleType]}
                  </span>
                </div>
                <div className="text-[var(--text-dim)] text-xs mt-1 space-x-3">
                  {contact.department && <span>{contact.department}</span>}
                  {contact.email && <span>{contact.email}</span>}
                  {contact.phone && <span>{contact.phone}</span>}
                  {contact.mobile && <span>{contact.mobile}</span>}
                </div>
              </div>
              <form action={deleteContact.bind(null, contact.id, company.id)}>
                <button type="submit" className={linkButton}>
                  削除
                </button>
              </form>
            </div>
          ))}
          {company.contacts.length === 0 && (
            <p className="text-sm text-[var(--text-dim)]">まだ担当者が登録されていません。</p>
          )}
        </div>

        <details className="border-t border-[var(--line)] pt-4">
          <summary className="text-sm cursor-pointer text-[var(--text-dim)]">担当者を追加</summary>
          <form action={addContact} className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input type="hidden" name="companyId" value={company.id} />
            <input name="name" placeholder="氏名" required className={inputClass} />
            <input name="title" placeholder="役職" className={inputClass} />
            <input name="department" placeholder="部署" className={inputClass} />
            <input name="email" placeholder="メール" className={inputClass} />
            <input name="phone" placeholder="電話" className={inputClass} />
            <input name="mobile" placeholder="携帯電話" className={inputClass} />
            <select name="roleType" defaultValue="OTHER" className={inputClass}>
              <option value="DECISION_MAKER">決裁者</option>
              <option value="OPERATIONAL">実務担当者</option>
              <option value="OTHER">その他</option>
            </select>
            <button type="submit" className={`sm:col-span-3 justify-self-start ${primaryButton}`}>
              追加
            </button>
          </form>
        </details>
      </section>
    </div>
  );
}
