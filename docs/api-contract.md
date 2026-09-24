# 前後端 API 契約（給後端）

型別定義在 `src/api/types.ts`，介面在 `src/api/api.ts`，HTTP 實作在 `src/api/http.ts`。
後端只要照下表提供路徑與 JSON，把 `.env` 設成 `VITE_API_MODE=http`，前端不用改頁面程式。
JSON 欄位用 camelCase；id 為字串；時間為 ISO 8601；登入用 cookie（`credentials: include`）。
錯誤格式：HTTP 狀態碼 + `{ "message": "給使用者看的說明" }`；未登入回 401。

## 認證
| 方法 | 路徑 | 說明 |
|---|---|---|
| POST | `/api/auth/login` | `{ role, name }` → `User`（目前示範用，之後換真的登入） |
| GET | `/api/me` | 目前使用者；未登入 401 |
| POST | `/api/auth/logout` | 204 |

## 議題與題庫
| GET | `/api/archives` | `Archive[]` |
|---|---|---|
| POST | `/api/archives` | `{ title }` → `Archive`（首頁提問框開始一段新對話） |
| GET | `/api/archives/:id/dialogue` | `DialogueMessage[]`（議題的自由對話） |
| POST | `/api/archives/:id/dialogue` | `{ text }`，回應同階段 1 的 **SSE** 格式（`delta` / `done`） |
| PATCH | `/api/archives/:id` | `{ bank?: "private"\|"public"\|null, inSummary?: boolean }` → `Archive`（私人 / 公開只能擇一由後端保證） |

## 教室與活動
| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/api/classrooms` | `Classroom[]` |
| GET | `/api/classrooms/:id` | `Classroom` |
| POST | `/api/classrooms` | `{ name }`（僅老師）→ `Classroom` |
| POST | `/api/classrooms/:id/invite/accept` | 學生接受邀請 → `Classroom`（`joined` 變成 true） |
| POST | `/api/classrooms/:id/invite/decline` | 學生拒絕邀請，204 |
| GET | `/api/classrooms/:id/members` | `ClassroomMember[]`（姓名、在線、最近一次對話、完成度） |
| POST | `/api/classrooms/:id/members` | `{ name }`（僅老師）→ `ClassroomMember` |
| DELETE | `/api/classrooms/:id/members/:memberId` | 僅老師，204 |
| GET | `/api/classrooms/:id/activities` | `Activity[]` |
| POST | `/api/classrooms/:id/activities` | `CreateActivityInput`（僅老師）→ `Activity` |
| GET | `/api/activities/:id` | `Activity` |
| POST | `/api/activities/:id/advance` | 僅老師；**由活動狀態機（FSM）決定能否推進**；個人調查→團隊提純時由後端分組 |
| GET | `/api/activities/:id/events` | **SSE**，事件見 `ActivityEvent`（階段切換、組內訊息、輪到誰、新發言與評分） |
| GET | `/api/activities/:id/members` | `Member[]` |

## 階段 1：個人調查
| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/api/activities/:id/dialogue` | `DialogueMessage[]`（只有自己的） |
| POST | `/api/activities/:id/dialogue` | `{ text }`，回應為 **SSE**：`event: delta` `data: {"text":"…"}` 多次，最後 `event: done` `data: {"message": DialogueMessage}`。最多 20 輪與收尾條件由後端控制 |
| GET | `/api/activities/:id/progress` | `Progress`（四個面向 `coverage`、`rounds`、`maxRounds`、`readyToSummarize`） |
| POST | `/api/activities/:id/position/draft` | AI 依對話估計座標與論點 → `PositionDraft` |
| PUT | `/api/activities/:id/position` | 學生確認 → `Position`（階段 1 結束前可再改） |
| GET | `/api/activities/:id/positions` | 老師：全班；學生：只有自己（階段 2 分組前不公開他人座標） |

## 階段 2：團隊提純
| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/api/activities/:id/groups` | `Group[]` |
| POST | `/api/activities/:id/groups/regroup` | `{ groupSize }`（僅老師） |
| GET/POST | `/api/groups/:gid/messages` | 組內聊天 |
| POST | `/api/groups/:gid/ai/summarize` | AI 整理論點 → `GroupArgument[]` |
| POST | `/api/groups/:gid/ai/counterexample` | AI 對一條主張丟反例 → `GroupMessage`（`ai_counterexample`） |
| GET | `/api/groups/:gid/arguments` | `GroupArgument[]` |
| POST | `/api/arguments/:id/vote` | `{ vote: "endorse"\|"revise"\|"oppose" }`；狀態（active/revised/dropped/contested）由後端重算 |
| POST | `/api/groups/:gid/split` | 出現分歧時把不同意的人分成新組 |

## 階段 3：辯論比賽
| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/api/activities/:id/rooms` | `Room[]`（配對由後端做：中心距離最遠的先配） |
| POST | `/api/rooms/:id/start` | 開始比賽（主持人開場） |
| GET | `/api/rooms/:id/turns` | `{ turns, judgments }` |
| POST | `/api/rooms/:id/turns` | `{ text }`；**輪到誰、計時、逾時都由後端判定**；同時產生 `Judgment`（AI 裁判） |
| PATCH | `/api/judgments/:id` | `{ teacherScore: number\|null }`（僅老師覆寫） |

## 立場星圖
| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/api/activities/:id/star` | `StarData`。階段 1：老師只看到已確認的人、沒有分組；階段 2 之後含分組；活動結束後多一步「團隊提純後」。學生看不到其他人的名字 |

## 結果
| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/api/activities/:id/scores` | `ScoreRow[]`（老師：全班；學生：自己） |
| PATCH | `/api/activities/:id/scores/:memberId` | `{ adjust }`（僅老師） |

## 原型裡「模擬」的部分，對應到後端要做的事
| 原型（`debate-ai.js`） | 後端 |
|---|---|
| 模擬同學的立場與發言 | 不需要：真人；測試時另做「機器人成員」 |
| 座標估計、論點整理、反例、主持人、裁判 | LLM 流程（結構化輸出）；規則式裁判可保留當保底與測試基準 |
| k-means 分組、分組平衡、配對 | 分群服務 |
| 計分公式（個人 / 團隊 / 辯論加權） | 計分服務；權重由老師設定 |
| 「示範：讓老師推進」按鈕 | 移除，只有老師能推進 |
