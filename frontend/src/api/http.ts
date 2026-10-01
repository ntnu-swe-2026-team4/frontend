import type { Api } from "./api";
import type { ActivityEvent, DialogueMessage } from "./types";

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = (await res.json()) as { message?: string; detail?: string };
      detail = j.message ?? j.detail ?? detail;
    } catch {
      /* 不是 JSON 就用 statusText */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const get = <T>(p: string) => req<T>("GET", p);
const post = <T>(p: string, b?: unknown) => req<T>("POST", p, b ?? {});
const put = <T>(p: string, b: unknown) => req<T>("PUT", p, b);
const patch = <T>(p: string, b: unknown) => req<T>("PATCH", p, b);

/** 送出對話並讀取 SSE：event: delta {text} … event: done {message} */
async function streamDialogue(path: string, text: string, onDelta?: (c: string) => void): Promise<DialogueMessage> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok || !res.body) throw new ApiError(res.status, res.statusText);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let final: DialogueMessage | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const ev = /^event: (.+)$/m.exec(block)?.[1];
      const data = /^data: (.+)$/m.exec(block)?.[1];
      if (!data) continue;
      const payload = JSON.parse(data) as { text?: string; message?: DialogueMessage };
      if (ev === "delta" && payload.text) onDelta?.(payload.text);
      if (ev === "done" && payload.message) final = payload.message;
    }
  }
  if (!final) throw new ApiError(502, "串流結束但沒有收到完整訊息");
  return final;
}

export const httpApi: Api = {
  login: (i) => post("/api/auth/login", i),
  me: async () => {
    try {
      return await get("/api/me");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  },
  logout: () => post("/api/auth/logout"),

  listArchives: () => get("/api/archives"),
  updateArchive: (id, p) => patch(`/api/archives/${id}`, p),

  createArchive: (title) => post("/api/archives", { title }),
  listTopicDialogue: (id) => get(`/api/archives/${id}/dialogue`),
  sendTopicDialogue: (id, text, onDelta) => streamDialogue(`/api/archives/${id}/dialogue`, text, onDelta),

  listClassrooms: () => get("/api/classrooms"),
  getClassroom: (id) => get(`/api/classrooms/${id}`),
  createClassroom: (name) => post("/api/classrooms", { name }),
  acceptInvite: (id) => post(`/api/classrooms/${id}/invite/accept`),
  declineInvite: (id) => post(`/api/classrooms/${id}/invite/decline`),
  listClassroomMembers: (id) => get(`/api/classrooms/${id}/members`),
  addClassroomMember: (id, name) => post(`/api/classrooms/${id}/members`, { name }),
  removeClassroomMember: (id, mid) => req("DELETE", `/api/classrooms/${id}/members/${mid}`),
  listActivities: (cid) => get(`/api/classrooms/${cid}/activities`),
  getActivity: (id) => get(`/api/activities/${id}`),
  createActivity: (cid, i) => post(`/api/classrooms/${cid}/activities`, i),
  advanceActivity: (id) => post(`/api/activities/${id}/advance`),

  listDialogue: (id) => get(`/api/activities/${id}/dialogue`),
  sendDialogue: (id, text, onDelta) => streamDialogue(`/api/activities/${id}/dialogue`, text, onDelta),
  getProgress: (id) => get(`/api/activities/${id}/progress`),
  draftPosition: (id) => post(`/api/activities/${id}/position/draft`),
  confirmPosition: (id, p) => put(`/api/activities/${id}/position`, p),
  listPositions: (id) => get(`/api/activities/${id}/positions`),

  listMembers: (id) => get(`/api/activities/${id}/members`),
  listGroups: (id) => get(`/api/activities/${id}/groups`),
  regroup: (id, groupSize) => post(`/api/activities/${id}/groups/regroup`, { groupSize }),
  listGroupMessages: (gid) => get(`/api/groups/${gid}/messages`),
  postGroupMessage: (gid, text) => post(`/api/groups/${gid}/messages`, { text }),
  summarizeGroup: (gid) => post(`/api/groups/${gid}/ai/summarize`),
  counterexample: (gid) => post(`/api/groups/${gid}/ai/counterexample`),
  listArguments: (gid) => get(`/api/groups/${gid}/arguments`),
  vote: (aid, vote) => post(`/api/arguments/${aid}/vote`, { vote }),
  splitGroup: (gid) => post(`/api/groups/${gid}/split`),

  listRooms: (id) => get(`/api/activities/${id}/rooms`),
  startRoom: (rid) => post(`/api/rooms/${rid}/start`),
  listTurns: (rid) => get(`/api/rooms/${rid}/turns`),
  postTurn: (rid, text) => post(`/api/rooms/${rid}/turns`, { text }),
  overrideJudgment: (jid, teacherScore) => patch(`/api/judgments/${jid}`, { teacherScore }),

  listScores: (id) => get(`/api/activities/${id}/scores`),
  adjustScore: (id, memberId, adjust) => patch(`/api/activities/${id}/scores/${memberId}`, { adjust }),

  getStarData: (id) => get(`/api/activities/${id}/star`),

  subscribe(id, onEvent) {
    const es = new EventSource(`${BASE}/api/activities/${id}/events`, { withCredentials: true });
    es.onmessage = (m) => onEvent(JSON.parse(m.data) as ActivityEvent);
    return () => es.close();
  },
};
