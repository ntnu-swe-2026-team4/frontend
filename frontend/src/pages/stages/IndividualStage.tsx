import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { api, type Activity, type Coverage, type PositionDraft } from "@/api";
import { keys, useConfirmPosition, useDialogue, useMembers, usePositions, useProgress, useStar } from "@/api/queries";
import { StarMap } from "@/components/star/StarMap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MemberChip, Panel, StageLayout } from "./shared";

const COV: [keyof Coverage, string][] = [["claim", "主張"], ["reason", "理由"], ["evidence", "證據或例子"], ["counter", "反例的回應"]];
const STEPS = [-1, -2 / 3, -1 / 3, 0, 1 / 3, 2 / 3, 1];

/** 右側：跟蘇格拉底的對話（回覆用串流一段一段出現） */
function ChatPanel({ a, readOnly }: { a: Activity; readOnly: boolean }) {
  const qc = useQueryClient();
  const { data: messages = [] } = useDialogue(a.id);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [mine, setMine] = useState<string | null>(null);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages, pending, mine]);

  async function send() {
    const t = text.trim();
    if (!t || pending !== null) return;
    setText(""); setMine(t); setPending(""); setError("");
    try {
      await api.sendDialogue(a.id, t, (c) => setPending((p) => (p ?? "") + c));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(null); setMine(null);
      qc.invalidateQueries({ queryKey: keys.dialogue(a.id) });
      qc.invalidateQueries({ queryKey: keys.progress(a.id) });
    }
  }

  const bubble = (role: "user" | "assistant", body: string, key: string) => (
    <div key={key} className={cn("flex gap-3", role === "user" && "flex-row-reverse")}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line-strong bg-bg-2 font-serif text-sm text-bronze">{role === "user" ? "我" : "Σ"}</span>
      <p className={cn("max-w-[80%] rounded-2xl border border-line px-4 py-2.5 font-serif text-[14.5px] leading-7", role === "user" ? "bg-bronze-soft" : "bg-bg-2")}>{body}</p>
    </div>
  );
  return (
    <Panel>
      <div className="border-b border-line px-5 py-3 font-serif text-sm">與蘇格拉底對話</div>
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {bubble("assistant", `這場辯論的議題是「${a.statement}」。先不用急著下結論——你現在怎麼想？`, "opener")}
        {messages.map((m) => bubble(m.role, m.text, m.id))}
        {mine && bubble("user", mine, "mine")}
        {pending !== null && bubble("assistant", pending || "…", "pending")}
        {error && <p className="text-[12.5px] text-wine">{error}</p>}
        <div ref={end} />
      </div>
      {!readOnly && (
        <div className="flex items-end gap-2 border-t border-line p-3">
          <Textarea rows={1} value={text} placeholder="輸入你的想法…" onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
          <Button size="icon" onClick={() => void send()} disabled={pending !== null} aria-label="送出"><Send className="size-4" /></Button>
        </div>
      )}
    </Panel>
  );
}

function PositionDialog({ a, open, onOpenChange }: { a: Activity; open: boolean; onOpenChange: (v: boolean) => void }) {
  const confirm = useConfirmPosition(a.id);
  const { data: draft } = useQuery({ queryKey: ["draft", a.id, open], queryFn: () => api.draftPosition(a.id), enabled: open });
  const [form, setForm] = useState<PositionDraft | null>(null);
  const cur = form ?? draft ?? null;
  const nearest = (v: number) => STEPS.reduce((bi, s, i) => (Math.abs(s - v) < Math.abs(STEPS[bi] - v) ? i : bi), 0);
  const upd = (patch: Partial<PositionDraft>) => cur && setForm({ ...cur, ...patch });
  const sugIdx = (i: number) => (draft && draft.coords[i] !== 0 ? nearest(draft.coords[i]) : -1);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setForm(null); onOpenChange(v); }}>
      <DialogContent>
        <DialogTitle>整理我的想法</DialogTitle>
        <DialogDescription>AI 依對話估計了位置（標有 AI 的點），這只是估計，請依你真正的想法自己選。</DialogDescription>
        {cur ? (
          <div className="space-y-5">
            {a.axes.map((ax, i) => (
              <div key={ax.key}>
                <div className="mb-2 text-[13.5px] font-semibold text-bronze">{ax.name}</div>
                <div className="relative flex h-8 items-center justify-between px-1">
                  <span className="absolute inset-x-4 top-1/2 h-0.5 -translate-y-1/2 bg-bg-3" />
                  {STEPS.map((s, k) => (
                    <button key={k} type="button" aria-label={`${ax.name} ${k - 3}`} onClick={() => upd({ coords: cur.coords.map((c, j) => (j === i ? s : c)) })}
                      className={cn("relative size-6 cursor-pointer rounded-full border-2 bg-bg-1", nearest(cur.coords[i]) === k ? "border-bronze bg-bronze ring-4 ring-bronze-soft" : "border-bg-3 hover:border-bronze-dim")}>
                      {sugIdx(i) === k && <em className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-olive-soft px-1.5 text-[9.5px] font-bold not-italic text-olive">AI</em>}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-[11.5px] text-ink-faint"><span>{ax.left}</span><span>中立</span><span>{ax.right}</span></div>
              </div>
            ))}
            {(["claim", "reason", "evidence"] as const).map((k) => (
              <label key={k} className="block"><span className="mb-1 block text-xs text-ink-dim">{{ claim: "我的主張", reason: "我的理由", evidence: "證據或例子" }[k]}</span>
                <Textarea rows={2} value={cur.summary[k]} onChange={(e) => upd({ summary: { ...cur.summary, [k]: e.target.value } })} /></label>
            ))}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>先不整理</Button>
              <Button disabled={confirm.isPending} onClick={() => confirm.mutate(cur, { onSuccess: () => { setForm(null); onOpenChange(false); } })}>確認送出</Button>
            </div>
          </div>
        ) : <p className="text-sm text-ink-faint">整理中…</p>}
      </DialogContent>
    </Dialog>
  );
}

function PositionReadout({ a, coords, summary }: { a: Activity; coords: number[]; summary: PositionDraft["summary"] }) {
  return (
    <div className="space-y-3">
      {a.axes.map((ax, i) => (
        <div key={ax.key} className="grid grid-cols-[4.4em_1fr_3em] items-center gap-2 text-[13px]">
          <b className="text-bronze">{ax.name}</b>
          <span className="relative flex h-6 items-center justify-between text-[11px] text-ink-faint">
            <span className="absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-bg-3" />
            <em className="relative z-10 bg-bg-1 px-1 not-italic">{ax.left}</em>
            <i className="absolute top-1/2 z-20 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bronze ring-4 ring-bg-1" style={{ left: `${((coords[i] + 1) / 2) * 100}%` }} />
            <em className="relative z-10 bg-bg-1 px-1 not-italic">{ax.right}</em>
          </span>
          <span className="text-right text-xs text-ink-dim">{coords[i] >= 0 ? "+" : "−"}{Math.abs(coords[i]).toFixed(2)}</span>
        </div>
      ))}
      {(["claim", "reason", "evidence"] as const).map((k) => (
        <div key={k}><small className="text-[11px] text-ink-faint">{{ claim: "主張", reason: "理由", evidence: "證據或例子" }[k]}</small><p className="font-serif text-sm leading-relaxed">{summary[k] || "—"}</p></div>
      ))}
    </div>
  );
}

export function IndividualStage({ a, teacher, flow, view }: { a: Activity; teacher: boolean; flow: ReactNode; view: "current" | "past" }) {
  const { data: progress } = useProgress(a.id);
  const { data: positions = [] } = usePositions(a.id);
  const [dlg, setDlg] = useState(false);
  const qc = useQueryClient();
  const over = view === "past";
  const mine = positions.find((p) => p.confirmed);

  if (teacher) return <TeacherIndividual a={a} flow={flow} />;

  const left = (
    <Card className="p-4">
      <CardTitle className="flex items-center gap-2">個人調查 <Badge tone={mine ? "olive" : progress?.rounds ? "bronze" : "neutral"}>{mine ? "已確認" : progress?.rounds ? "對話中" : "尚未開始"}</Badge></CardTitle>
      <p className="mb-3 text-[12.5px] leading-relaxed text-ink-faint">右邊跟蘇格拉底聊。<b className="text-ink">AI 只提問、不給答案</b>，追問到你把想法講清楚，再整理成座標與論點總結。</p>
      {mine ? <PositionReadout a={a} coords={mine.coords} summary={mine.summary} /> : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {COV.map(([k, n]) => <span key={k} className={cn("rounded-full border px-3 py-1 text-[11.5px]", progress?.coverage[k] ? "border-olive-soft bg-olive-soft text-olive" : "border-line text-ink-faint")}>{progress?.coverage[k] ? "✓ " : ""}{n}</span>)}
          </div>
          <p className="my-3 text-[12.5px] text-ink-faint">已對話 <b>{progress?.rounds ?? 0}</b> / {progress?.maxRounds ?? 20} 輪{progress?.readyToSummarize ? "" : "（至少聊 2 輪才能整理）"}</p>
        </>
      )}
      {!over && <Button className="mt-2" size="sm" disabled={!mine && !progress?.readyToSummarize} onClick={() => setDlg(true)}>{mine ? "修改座標與論點" : "整理我的想法"}</Button>}
      <p className="mt-3 text-[11.5px] text-ink-faint">其他同學的座標，在階段 2 分組之前不會公開。</p>
      <PositionDialog a={a} open={dlg} onOpenChange={(v) => { setDlg(v); if (!v) qc.invalidateQueries({ queryKey: keys.positions(a.id) }); }} />
    </Card>
  );
  return <StageLayout flow={flow} left={left} right={<ChatPanel a={a} readOnly={over} />} />;
}

function TeacherIndividual({ a, flow }: { a: Activity; flow: ReactNode }) {
  const qc = useQueryClient();
  const { data: members = [] } = useMembers(a.id);
  const { data: star } = useStar(a.id, "individual");
  const confirmed = members.filter((m) => m.individual?.status === "confirmed").length;
  const pending = members.some((m) => m.simulated && m.individual?.status !== "confirmed");

  const left = (
    <>
      <Card className="p-4">
        <CardTitle>個人調查</CardTitle>
        <p className="mb-3 text-[12.5px] leading-relaxed text-ink-faint">每位同學獨立跟 AI 對話；AI 只提問。完成後每人產出<b className="text-ink">座標</b>與<b className="text-ink">論點總結</b>。</p>
        <div className="grid grid-cols-[4em_1fr_auto] items-center gap-3 text-[13px]"><span>已確認</span><span className="h-2 overflow-hidden rounded bg-bg-3"><i className="block h-full bg-bronze" style={{ width: `${members.length ? (confirmed / members.length) * 100 : 0}%` }} /></span><em className="not-italic text-ink-faint">{confirmed} / {members.length}</em></div>
        {api.dev && pending && <Button variant="outline" size="sm" className="mt-3" onClick={async () => { await api.dev!.simulateIndividual(a.id); qc.invalidateQueries({ queryKey: keys.members(a.id) }); qc.invalidateQueries({ queryKey: keys.star(a.id) }); }}>模擬同學完成調查</Button>}
      </Card>
      <Card className="p-4">
        <CardTitle className="flex items-center justify-between">立場星圖 <span className="font-sans text-xs font-normal text-ink-faint">只有老師看得到</span></CardTitle>
        {star && star.agents.length ? <StarMap data={star} compact /> : <p className="text-[12.5px] text-ink-faint">還沒有人確認座標。同學確認後，這裡會出現每個人的位置。</p>}
      </Card>
    </>
  );
  const right = (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <Card>
        <CardTitle>成員進度</CardTitle>
        {members.map((m) => {
          const st = m.individual?.status ?? "todo";
          return (
            <div key={m.id} className="grid grid-cols-[1.3fr_auto_3.5em_1.6fr] items-center gap-3 border-t border-line py-3 text-[13px] first:border-t-0 max-md:grid-cols-[1fr_auto]">
              <span><MemberChip m={m} />{m.id === "you" && <em className="ml-2 rounded-full bg-bg-3 px-2 py-0.5 text-[10px] not-italic text-ink-dim">學生模式的你</em>}</span>
              <Badge tone={st === "confirmed" ? "olive" : st === "talking" ? "bronze" : "neutral"}>{{ confirmed: "已確認", talking: "對話中", todo: "未開始" }[st]}</Badge>
              <span className="text-xs text-ink-faint max-md:hidden">{m.individual?.rounds ?? 0} 輪</span>
              <span className="truncate text-xs text-ink-dim max-md:hidden">{m.individual?.claim ?? "—"}</span>
            </div>
          );
        })}
      </Card>
    </div>
  );
  return <StageLayout flow={flow} left={left} right={right} />;
}
