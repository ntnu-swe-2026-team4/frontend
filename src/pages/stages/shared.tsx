import type { ReactNode } from "react";
import type { Member } from "@/api";
import { cn } from "@/lib/utils";

/** 辯論頁的兩欄：左邊資訊（進度在最上面）、右邊留給對話 */
export function StageLayout({ flow, left, right }: { flow: ReactNode; left: ReactNode; right: ReactNode }) {
  return (
    <div className="grid min-h-0 flex-1 gap-3.5 md:grid-cols-[minmax(300px,350px)_1fr]">
      <aside className="no-scrollbar flex min-h-0 flex-col gap-3 overflow-y-auto">{flow}{left}</aside>
      <section className="flex min-h-0 flex-col">{right}</section>
    </div>
  );
}

export const Bar = ({ value, max = 5, className }: { value: number | null; max?: number; className?: string }) => (
  <span className={cn("block h-1.5 overflow-hidden rounded bg-bg-3", className)}>
    <i className="block h-full rounded bg-bronze" style={{ width: `${value === null ? 0 : (value / max) * 100}%` }} />
  </span>
);

export function MemberChip({ m }: { m: Pick<Member, "name" | "isMe" | "simulated"> }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px]">
      <i className={cn("flex size-6 items-center justify-center rounded-full font-serif text-[11.5px] not-italic", m.isMe ? "bg-bronze text-[#221a0c]" : "bg-bronze-soft text-bronze")}>{m.name[0]}</i>
      {m.name}
      {m.simulated && <em className="rounded-full bg-bg-3 px-1.5 py-px text-[10px] not-italic text-ink-dim" title="教室人數不足時，系統補齊的模擬同學">模擬</em>}
    </span>
  );
}

export const Panel = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-line bg-bg-1", className)}>{children}</div>
);
