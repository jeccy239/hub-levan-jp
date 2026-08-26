import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { updateTaskStatus } from "../companies/actions";
import { TASK_PRIORITY_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

const card = "border border-[var(--line)] rounded-2xl p-4 bg-[var(--surface)] shadow-sm";

export default async function TasksPage() {
  const tasks = await prisma.task.findMany({
    where: { status: { not: "DONE" } },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
    include: { company: true, assignee: true },
  });

  const overdue = tasks.filter((t) => t.dueDate && t.dueDate < new Date());
  const upcoming = tasks.filter((t) => !t.dueDate || t.dueDate >= new Date());

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text)]">タスク</h1>
        <p className="text-[var(--text-dim)] mt-1">未完了のタスクを横断表示します。</p>
      </div>

      {overdue.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--danger)]">期限超過（{overdue.length}件）</h2>
          {overdue.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--text)]">対応待ち</h2>
        {upcoming.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
        {tasks.length === 0 && <p className="text-sm text-[var(--text-dim)]">未完了のタスクはありません。</p>}
      </section>
    </div>
  );
}

function TaskRow({
  task,
}: {
  task: {
    id: string;
    title: string;
    dueDate: Date | null;
    priority: string;
    companyId: string | null;
    company: { id: string; name: string } | null;
    assignee: { name: string } | null;
  };
}) {
  return (
    <div className={`${card} flex items-center justify-between gap-4`}>
      <div className="text-sm text-[var(--text)]">
        <div className="font-medium">{task.title}</div>
        <div className="text-xs text-[var(--text-dim)] mt-0.5">
          {task.company && (
            <Link href={`/companies/${task.company.id}`} className="text-[var(--accent)] hover:underline">
              {task.company.name}
            </Link>
          )}
          {task.dueDate && ` ・ 期限 ${task.dueDate.toLocaleDateString("ja-JP")}`} ・ 優先度{" "}
          {TASK_PRIORITY_LABEL[task.priority]}
          {task.assignee && ` ・ ${task.assignee.name}`}
        </div>
      </div>
      <form action={updateTaskStatus.bind(null, task.id, "DONE", task.companyId ?? undefined)}>
        <button
          type="submit"
          className="text-xs px-2.5 py-1 rounded-full font-medium bg-[var(--surface-2)] text-[var(--text-dim)] hover:bg-[var(--line)]"
        >
          完了にする
        </button>
      </form>
    </div>
  );
}
