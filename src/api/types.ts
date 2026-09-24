/**
 * 前後端的資料契約。後端（Rust / Axum）依這份型別回傳 JSON；
 * 之後可改成由 OpenAPI 自動產生，欄位名稱與意義維持一致即可。
 * 所有 id 都是字串，時間都是 ISO 8601。
 */
export type Role = "student" | "teacher";

export interface User {
  id: string;
  name: string;
  role: Role;
  avatarUrl?: string;
}

/* ---------- 議題（對話存檔）與題庫 ---------- */
export type BankKind = "private" | "public";

export interface Archive {
  id: string;
  title: string;
  date: string;
  rounds: number;
  snippet: string;
  bank: BankKind | null;
  inSummary: boolean;
  /** 由辯論活動產生的議題，繼續對話時要回到該活動 */
  activityId?: string;
}

/* ---------- 教室 ---------- */
export interface Classroom {
  id: string;
  name: string;
  teacherName: string;
  studentCount: number;
  debateCount: number;
  /** false = 老師邀請了你，還沒接受（學生看到「待處理邀請」） */
  joined: boolean;
}

/** 教室成員表的一列（成員分頁） */
export interface ClassroomMember {
  id: string;
  name: string;
  online: boolean;
  lastActive: string;
  /** 完成度 0–100 */
  progress: number;
}

/* ---------- 辯論活動 ---------- */
export type Stage = "individual" | "team" | "debate" | "done";
export type AnswerMode = "text" | "voice" | "both";

export interface Axis {
  key: string;
  name: string;
  /** 座標 -1 那一端 */
  left: string;
  /** 座標 +1 那一端 */
  right: string;
}

export interface Activity {
  id: string;
  classroomId: string;
  title: string;
  statement: string;
  answerMode: AnswerMode;
  axes: Axis[];
  groupSize: number;
  stage: Stage;
  memberCount: number;
  createdAt: string;
}

export interface CreateActivityInput {
  title: string;
  statement: string;
  answerMode: AnswerMode;
  axes: Omit<Axis, "key">[];
  groupSize: number;
}

/* ---------- 階段 1：個人調查 ---------- */
export interface DialogueMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string;
}

/** 對話進度：四個面向有沒有出現（由後端的 LLM 流程判斷） */
export interface Coverage {
  claim: boolean;
  reason: boolean;
  evidence: boolean;
  counter: boolean;
}

export interface Progress {
  rounds: number;
  maxRounds: number;
  coverage: Coverage;
  readyToSummarize: boolean;
}

export interface PositionDraft {
  /** 每條價值軸一個 -1..+1 的座標，順序同 Activity.axes */
  coords: number[];
  summary: { claim: string; reason: string; evidence: string };
  /** AI 只是估計，最後由學生確認 */
  aiSuggested: boolean;
}

export interface Position extends PositionDraft {
  memberId: string;
  confirmed: boolean;
}

/* ---------- 階段 2：團隊提純 ---------- */
export interface Member {
  id: string;
  name: string;
  isMe: boolean;
  /** 示範資料裡由系統補齊的模擬同學（真後端沒有這個概念） */
  simulated: boolean;
  /** 階段 1 的進度（老師看得到全班；學生只看得到自己） */
  individual?: { status: "todo" | "talking" | "confirmed"; rounds: number; claim?: string };
}

export interface Group {
  id: string;
  label: string;
  memberIds: string[];
  centroid: number[];
  formedBy: "auto" | "split";
}

export type ArgumentKind = "claim" | "reason" | "evidence";
export type ArgumentStatus = "active" | "revised" | "dropped" | "contested";
export type Vote = "endorse" | "revise" | "oppose";

export interface GroupArgument {
  id: string;
  groupId: string;
  kind: ArgumentKind;
  text: string;
  parentId: string | null;
  axisIndex: number;
  status: ArgumentStatus;
  votes: Record<string, Vote>;
  countered: boolean;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  kind: "chat" | "system" | "ai_summary" | "ai_counterexample";
  authorId?: string;
  text: string;
  at: string;
}

/* ---------- 階段 3：辯論比賽 ---------- */
export type Phase = "opening" | "cross" | "rebuttal" | "closing";
export type Side = "a" | "b";

export interface Room {
  id: string;
  activityId: string;
  groupA: string;
  groupB: string;
  status: "scheduled" | "live" | "finished";
  phase: Phase | "ended";
  /** 目前輪到誰；null = 沒人（尚未開始或已結束） */
  turn: { side: Side; memberId: string; role: "ask" | "answer" | "speak"; deadline: string } | null;
}

export interface Turn {
  id: string;
  roomId: string;
  seq: number;
  side: Side | "moderator";
  memberId?: string;
  phase?: Phase;
  text: string;
  at: string;
}

export type CriterionKey = "evidence" | "reasoning" | "rebuttal" | "clarity";

export interface Judgment {
  id: string;
  turnId: string;
  roomId: string;
  side: Side;
  memberId: string;
  phase: Phase;
  /** 0–5；該回合不適用時為 null（例如開場沒有「回應」） */
  scores: Record<CriterionKey, number | null>;
  notes: Partial<Record<CriterionKey, string>>;
  verifiability: "sourced" | "checkable" | "unverified";
  /** 老師覆寫的整體分；null = 沿用 AI */
  teacherScore: number | null;
}

/* ---------- 結果 ---------- */
export interface ScoreRow {
  memberId: string;
  memberName: string;
  individual: number;
  team: number;
  debate: number;
  adjust: number;
  total: number;
}

/* ---------- 即時事件（SSE：GET /api/activities/:id/events） ---------- */
export type ActivityEvent =
  | { type: "stage_changed"; stage: Stage }
  | { type: "group_message"; message: GroupMessage }
  | { type: "argument_updated"; argument: GroupArgument }
  | { type: "turn_created"; turn: Turn; judgment?: Judgment }
  | { type: "room_updated"; room: Room };

/* ---------- 立場星圖 ---------- */
export interface StarData {
  axes: Axis[];
  /** 每位成員在每一步的座標：history[step][axisIndex]，範圍 -1..+1 */
  agents: { id: number; me: boolean; history: number[][] }[];
  /** 已分組時才有：assignments[i] 是第 i 位成員所屬組別的索引 */
  groups: { labels: string[]; assignments: number[] } | null;
  stepLabels: string[];
  stepNotes: string[];
  initialStep: number;
  /** 只有一個時間點時為 false（例如階段 1），畫面就不顯示時間軸 */
  hasTimeline: boolean;
}
