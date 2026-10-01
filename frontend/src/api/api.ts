import type {
  Activity, ActivityEvent, Archive, BankKind, Classroom, ClassroomMember, CreateActivityInput,
  DialogueMessage, Group, GroupArgument, GroupMessage, Judgment, Member, Position,
  PositionDraft, Progress, Room, ScoreRow, StarData, Turn, User, Role, Vote,
} from "./types";

/**
 * 前端只依賴這個介面。有兩個實作：
 *  - mockApi：前端內建的示範資料（沒有後端也能跑）
 *  - httpApi：呼叫 Rust 後端（路徑見 docs/api-contract.md）
 * 用 VITE_API_MODE 切換，畫面與頁面程式不用改。
 */
export interface Api {
  /* 認證 */
  login(input: { role: Role; name: string }): Promise<User>;
  me(): Promise<User | null>;
  logout(): Promise<void>;

  /* 議題與題庫 */
  listArchives(): Promise<Archive[]>;
  updateArchive(id: string, patch: { bank?: BankKind | null; inSummary?: boolean }): Promise<Archive>;
  /** 開始一段新的自由對話（首頁提問框）；回傳新的議題 */
  createArchive(title: string): Promise<Archive>;
  /** 議題的自由對話（單人 → 對話）；sendTopicDialogue 的回覆同樣用串流 */
  listTopicDialogue(archiveId: string): Promise<DialogueMessage[]>;
  sendTopicDialogue(archiveId: string, text: string, onDelta?: (chunk: string) => void): Promise<DialogueMessage>;

  /* 教室與辯論活動 */
  listClassrooms(): Promise<Classroom[]>;
  getClassroom(id: string): Promise<Classroom>;
  createClassroom(name: string): Promise<Classroom>; // 僅老師
  acceptInvite(classroomId: string): Promise<Classroom>; // 學生接受邀請
  declineInvite(classroomId: string): Promise<void>;
  listClassroomMembers(classroomId: string): Promise<ClassroomMember[]>;
  addClassroomMember(classroomId: string, name: string): Promise<ClassroomMember>; // 僅老師
  removeClassroomMember(classroomId: string, memberId: string): Promise<void>; // 僅老師
  listActivities(classroomId: string): Promise<Activity[]>;
  getActivity(id: string): Promise<Activity>;
  createActivity(classroomId: string, input: CreateActivityInput): Promise<Activity>;
  /** 老師推進階段；後端的活動狀態機（FSM）決定能不能推進 */
  advanceActivity(id: string): Promise<Activity>;

  /* 階段 1：個人調查 */
  listDialogue(activityId: string): Promise<DialogueMessage[]>;
  /** 送出一句話；回覆用串流一段一段回來（後端 SSE），最後回傳完整訊息 */
  sendDialogue(activityId: string, text: string, onDelta?: (chunk: string) => void): Promise<DialogueMessage>;
  getProgress(activityId: string): Promise<Progress>;
  draftPosition(activityId: string): Promise<PositionDraft>;
  confirmPosition(activityId: string, position: PositionDraft): Promise<Position>;
  listPositions(activityId: string): Promise<Position[]>; // 老師：全班；學生：只有自己

  /* 階段 2：團隊提純 */
  listMembers(activityId: string): Promise<Member[]>;
  listGroups(activityId: string): Promise<Group[]>;
  regroup(activityId: string, groupSize: number): Promise<Group[]>;
  listGroupMessages(groupId: string): Promise<GroupMessage[]>;
  postGroupMessage(groupId: string, text: string): Promise<GroupMessage>;
  summarizeGroup(groupId: string): Promise<GroupArgument[]>;
  counterexample(groupId: string): Promise<GroupMessage>;
  listArguments(groupId: string): Promise<GroupArgument[]>;
  vote(argumentId: string, vote: Vote): Promise<GroupArgument>;
  splitGroup(groupId: string): Promise<Group[]>;

  /* 階段 3：辯論比賽 */
  listRooms(activityId: string): Promise<Room[]>;
  startRoom(roomId: string): Promise<Room>;
  listTurns(roomId: string): Promise<{ turns: Turn[]; judgments: Judgment[] }>;
  postTurn(roomId: string, text: string): Promise<Turn>;
  overrideJudgment(judgmentId: string, teacherScore: number | null): Promise<Judgment>;

  /* 結果 */
  listScores(activityId: string): Promise<ScoreRow[]>;
  adjustScore(activityId: string, memberId: string, adjust: number): Promise<ScoreRow>;

  /** 立場星圖的資料：階段 1 只有已確認的人、沒有分組；階段 2 之後有分組；結束後多一步「團隊提純後」 */
  getStarData(activityId: string): Promise<StarData>;

  /**
   * 只有示範用的假後端才有（真後端不需要實作）：
   * 讓模擬同學完成調查、模擬整場辯論、學生示範推進階段。
   */
  dev?: {
    simulateIndividual(activityId: string): Promise<number>;
    simulateRoom(roomId: string): Promise<Room>;
    simulateAllRooms(activityId: string): Promise<void>;
  };

  /** 訂閱活動的即時事件（階段切換、新訊息、輪到誰…）；回傳取消訂閱的函式 */
  subscribe(activityId: string, onEvent: (e: ActivityEvent) => void): () => void;
}
