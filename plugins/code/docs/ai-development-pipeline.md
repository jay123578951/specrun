# AI 開發 Pipeline 設計

## 目標

設計一套完整的 AI 輔助開發流程，在設計文件完成後，AI 透過專業分工的 agent pipeline 自動完成實作、測試、審查與交付。

本流程採**變更分級制度**，依影響範圍選擇對應流程，避免小改動承受完整 Pipeline 的文件負擔。**無論哪個等級，Spec 都必須保持同步** — 這是 SDD（Spec-Driven Development）的核心原則。

## 工具依賴

新專案啟動只需安裝以下三樣：

| 工具 | 來源 | 職責 |
|------|------|------|
| **OpenSpec**（建議安裝） | [OpenSpec](https://github.com/Fission-AI/OpenSpec) | SDD 變更管理：explore、propose、apply、verify、sync、archive |
| **antfu/skills** | [github.com/antfu/skills](https://github.com/antfu/skills) | 知識型 skills：vue、nuxt、vitest、antfu、vue-best-practices 等 |
| **code:decisions / code:feat / code:fix / code:review / code:verify-flow / code:comment** | 專案自有 commands + skills | 流程型：動手前決策收斂（`/code:decisions`）、Tier 3 三角色 Pipeline（`/code:feat`）、Tier 2 輕量 Pipeline（`/code:fix`）、獨立 Code Review（`/code:review`）、操作流程驗證（`/code:verify-flow`）、註解整理（`/code:comment`） |
| **claude-in-chrome**（操作流程驗證用） | Claude Code 內建瀏覽器工具 | 讓操作流程驗證 Agent 在真瀏覽器實際點擊走完 spec 流程；僅觸及 UI/流程的變更才用到 |

---

## 變更分級

所有變更依影響範圍分為三個等級，選擇對應流程。

### 判斷標準

| 考量 | Tier 1 微調 | Tier 2 小改動 | Tier 3 完整功能 |
|------|------------|--------------|----------------|
| 影響檔案數 | 1-2 個 | 2-5 個 | 5+ 個或跨模組 |
| 需要設計決策 | 否 | 否 | 是 |
| 新增 API / 元件 | 否 | 否 | 是 |
| 預估時間 | < 30 分鐘 | 30 分鐘 ~ 2 小時 | > 2 小時 |
| 範例 | CSS 微調、文字修正、單行 bug fix | 跨檔案 bug fix、小型 UI 調整、composable 修正 | 新功能、大型重構、架構變更 |

### 流程總覽

```
收到需求 → 判斷 Tier
  ├─ Tier 1 (微調)
  │    主目錄直接修改 → ESLint --fix → 人工確認 → Spec 影響檢查 → Commit
  │
  ├─ Tier 2 (小改動)
  │    建立 branch → Coder + Tester → 註解整理 → 人工確認 → Spec 影響檢查
  │    → Commit → merge 回 main
  │
  └─ Tier 3 (完整功能)
       建立 branch（或 worktree）→ /opsx:explore →〔決策分支多時〕/code:decisions → /opsx:propose
       → code:feat（Coder→Tester→Reviewer→註解整理）→ /opsx:verify → /opsx:sync → /opsx:archive → merge 回 main
```

---

## Tier 1: 微調

適用：CSS 微調、文字修正、單行 bug fix、依賴版本更新

```
直接修改 → ESLint --fix → 人工確認 → Spec 影響檢查 → Commit
```

- 跳過 OpenSpec change 流程（不建 proposal / design / tasks）
- 跳過 Agent Pipeline（不派發 Coder / Tester / Reviewer）
- 直接在主對話中完成修改
- Commit 前執行 **Spec 影響檢查**（見下方共用流程）

---

## Tier 2: 小改動

適用：跨檔案 bug fix、小型 UI 調整、composable 修正、行為微調

```
描述問題/需求
  → 建立 branch (git checkout -b fix-<描述>)
  → Coder (Sonnet/Opus) + Tester (Sonnet)
  → 註解整理 (Sonnet)
  → 人工確認
  → Spec 影響檢查
  → Commit（在 fix branch 上）
  → merge 回 main
```

透過 `/code:fix` 進入（command 位於 `.claude/commands/code/fix.md`）。

- **在獨立 branch 中開發**（不使用 worktree，改動範圍小不需目錄隔離）
- 跳過 OpenSpec change 流程（不建 proposal / design / tasks）
- **保留 Coder + Tester**（品質保證）
- 跳過 Reviewer（變更範圍小，不需多視角審查）
- Coder 與 Tester 的執行規則同 Tier 3（載入 skills、ESLint --fix、失敗重試最多 3 輪）
- Coder model 預設 sonnet；改動觸及安全敏感路徑，或 retry 進入第 2 輪起，升 opus（見「Model 分層策略」）
- Commit 前執行 **Spec 影響檢查**（見下方共用流程）

---

## Spec 影響檢查（Tier 1 & Tier 2 共用）

SDD 核心原則：**Code 和 Spec 永遠在同一個 commit 裡，不允許「程式改了但文件沒跟上」的狀態。**

Tier 1 / Tier 2 不走 OpenSpec change 流程，但在 commit 前必須執行 Spec 影響檢查：

### 步驟

```
1. 列出本次修改的所有檔案
2. 比對以下位置的相關規格：
   - openspec/specs/                       （主規格庫）
   - docs/plans/                           （設計文件）
   - docs/plans/design-system/MASTER.md    （設計系統）
3. 判斷：
   ├─ 無影響 → 直接 commit
   └─ 有影響 → 更新對應 spec → Code + Spec 一起 commit
```

### 常見情境

| 修改內容 | 可能影響的 Spec |
|----------|----------------|
| 風力等級閾值調整 | `openspec/specs/` 中的風力等級定義 |
| CSS 變數修改 | `docs/plans/design-system/MASTER.md` |
| API 端點調整 | `openspec/specs/` 中的 API 規格 |
| 元件 props 變更 | `openspec/specs/` 中的元件規格 |
| 錯字修正、純樣式微調 | 通常無影響，直接 commit |

---

## Tier 3: 完整功能

適用：新功能、大型重構、架構變更、新增 API / 元件

使用完整 Phase 1 → 4 Pipeline，透過 OpenSpec 管理變更與 spec 同步。

```
Phase 1: 設計
  /opsx:explore（主目錄，對話探索，可選）
  ✋ 確認要做
  → 建立 branch 或 worktree（見下方判斷標準）
  →〔決策分支多時〕/code:decisions（動手前收斂未定決策，可選）
  → /opsx:propose（一步完成 proposal → specs → design → tasks）
  產出：proposal + specs + design + tasks（在功能分支上）

Phase 2: 自動化實作
  Coder (Sonnet/Opus) → Tester (Sonnet)
    → Reviewer (Opus subagent) ∥ 操作流程驗證 (Sonnet subagent，觸及 UI/流程時)
    → 註解整理 (Sonnet)

Phase 3: 人工驗收
  人實際操作測試功能
  有問題 → 回到 Coder 修復 → 重跑 Tester + Reviewer
  直到人確認通過（無重試次數限制）

Phase 4: 交付
  /opsx:verify（完成度檢查）
  /opsx:sync（合併 delta spec 至主規格庫）
  /opsx:archive（歸檔已完成的變更）
  commit 文件 → commit 代碼（在功能分支上）
  merge 回 main → 如用 worktree 則清理 → push
  （後續 PR / CI / 部署依專案而定）
```

---

## Phase 1: 設計

### 步驟

1. **Explore（主目錄，對話探索，可選）**
   - 使用 `/opsx:explore`
   - 透過對話釐清需求、探索方案、達成共識
   - 結論可直接銜接 `/opsx:propose`
   - 需求已明確時可跳過此步驟
2. **建立 Branch 或 Worktree**
   - **預設用 branch**：`git checkout -b feature-<描述>`
   - **需要並行開發時用 worktree**：`claude --worktree feature-<描述>`（見 [Git Worktree 隔離開發](#git-worktree-隔離開發)）
   - 確保後續的變更 artifact 和實作代碼在同一個分支上
3. **Decisions（動手前決策收斂，決策分支多時）**
   - 使用 `/code:decisions`
   - 沿決策樹找出「Coder 動手時必須有答案、但目前未定」的分支，逐一收斂
   - 判斷軸是**未定決策分支多寡**，不是前端/後端：完整新功能、全新 UI 流程設計適用；既有功能調整、需求已明確時可跳過
   - 能從 CLAUDE.md / 既有慣例 / 程式碼推得的不打擾人；找不到未定分支即直接進 propose
   - 產出：結構化決策清單，餵給 `/opsx:propose`（不產 spec、不寫 code）
4. **Propose（正式文件化）**
   - `/opsx:propose` — 一步完成所有 artifacts
   - 將 discuss 的對話共識轉化為正式 artifacts
   - 產出：proposal → specs → design → tasks

### 產出物（由 OpenSpec 產出）

| Artifact | 說明 |
|----------|------|
| Proposal | 變更的目標與範圍 |
| Specs | 功能規格（Requirements + Scenarios） |
| Design | 技術設計方案（含檔案結構、API、資料流） |
| Tasks | 具體實作任務清單 |

### 結束條件

- 人工確認設計方案無誤
- 此階段不進行 commit
- 已在功能分支上，後續 Phase 2-4 直接在同一個分支繼續

---

## Phase 2: 自動化實作

### 入口

兩種入口依需求選用：

- `/code:feat` — Pipeline 版本，派發專職 agent 分工執行（Coder → Tester → Reviewer）
- `/opsx:apply` — 單一 agent，主對話直接實作所有 tasks

需要嚴謹流程時用 `/code:feat`（推薦），簡單任務可用 `/opsx:apply`。

### Agent Pipeline

三個專業 agent 依序執行，形成串行 pipeline：

```
💻 Coder (Sonnet/Opus)
  │  讀取 design + tasks
  │  撰寫實作代碼
  │  完成後跑專案 lint script（如 pnpm lint --fix，不計入重試次數）
  │
  ▼
🧪 Tester (Sonnet)
  │  讀取代碼 + design（預期行為）
  │  撰寫測試、執行測試
  │  失敗 → 回 Coder 修復（最多 3 輪）
  │
  ▼
┌─ 同一層 gate（可平行；都綠才往下）───────────────────────┐
│ 🔍 Reviewer（Opus subagent）                              │
│   Task tool 派發 Opus subagent，與主對話 Sonnet 隔離      │
│   code quality + 安全性 + 慣例 + spec alignment + 整合輸出 │
│   安全敏感路徑 / 第 2 輪 retry 仍 FAIL → adversarial      │
│                                                          │
│ 🖱️ 操作流程驗證（Sonnet subagent，觸及 UI/流程時才跑）     │
│   Task tool 派發 fresh-context subagent，載入            │
│   code-verify-flow + claude-in-chrome 瀏覽器工具          │
│   真點擊走完 spec 流程：不報錯/不中斷 + spec 明文元件與位置│
│   FAIL → 回 Coder（最多 3 輪）；BLOCKED（環境）→ ⛔ 問人  │
└──────────────────────────────────────────────────────────┘
  │  兩個 gate 都綠 → 往下（3 輪修不好 → ⛔ 停下來問人）
  ▼
🧹 註解整理（Sonnet subagent）
     所有 gate settle 後執行，載入 code-comment
     清除過時 / 疊加 / 思考流程 / 冗餘註解，保留 why 與功能型指令
     直接套用 Edit → lint --fix（專案 script）→ orchestrator 重跑測試作安全網
```

> **操作流程驗證的定位**：它跟 Reviewer 同屬「會把 code 打回 Coder 的關卡（gate）」，所以排在**同一層**、可平行跑（Reviewer 讀靜態 code、驗證跑 dev server，互不依賴）；誰 FAIL 就回 Coder，改完只 targeted re-check 受影響那關，兩關都綠才進註解整理。**註解整理必須排在所有 gate 之後**——它只動註解不動邏輯，跑一次清最終狀態最乾淨；且純註解改動不會弄壞走得通的流程（有「整理後重跑測試」當安全網），所以驗證永遠不需因註解整理而重跑。判準、subagent prompt、輸出格式見 `code-verify-flow` skill。

### Orchestrator

負責派發 agent、判斷結果、決定 retry 或繼續的角色。

> **現狀**：由主對話（人 + Claude）手動調度，流程已實測可行，但調度邏輯尚未標準化為 skill 或腳本。

### Model 分層策略

| Agent | Model | 理由 |
|-------|-------|------|
| Coder | Sonnet（預設）/ Opus | 預設 sonnet：實作代碼足夠，速度快、成本低，且 Tester + Opus Reviewer + retry 已能接住表層瑕疵。先驗上需深度推理（架構變更、安全敏感路徑、設計決策密集）或 retry 卡關時升 opus（見下方「Coder Model 升級條件」） |
| Tester | Sonnet | 撰寫測試不需最強推理 |
| Reviewer | Opus | 透過 Task tool 派發 Opus subagent；同時兼顧 code quality、安全性、慣例、spec alignment 與整合輸出。Subagent context 與主對話 Sonnet 隔離，提供獨立視角避免自評自審；Opus 推理深度也適合對抗 review |
| Reviewer (WARNING re-check) | Sonnet | 小範圍 re-check 不需 Opus，由 Sonnet subagent 跑 `code-review` 的 targeted check 即可 |
| 操作流程驗證 | Sonnet | 走瀏覽器流程屬操作性工作，Sonnet 足夠；fresh-context subagent 與主對話隔離取得獨立視角，避免自評自審 |
| 註解整理 | Sonnet | 收尾清理註解，載入 `code-comment`；判定屬機械性偏多不需 Opus，subagent 隔離取得 fresh eyes |

#### Coder Model 升級條件

Coder 預設 sonnet，orchestrator 在派發前判定是否升 opus。判定保守 — 一般任務（spec 明確、單模組、無安全顧慮）維持 sonnet。

**Tier 3（`/code:feat`）首次派發升級**（任一成立）：
- 架構變更 / 大型重構：跨多個模組邊界，或修改既有公開 interface（composable 回傳結構、store API、共用型別）
- 安全敏感路徑：auth、payment、API key 處理、session 管理（與 adversarial 判定共用條件）
- 設計決策密集：design.md 將較多實作方式留給 Coder 自行決定

**Tier 2（`/code:fix`）首次派發升級**：Tier 2 依定義為單模組、無設計決策的小改動，故僅保留「安全敏感路徑」一條。

**Retry 動態升級**（兩個 Tier 共用精神）：
- Tier 3：Reviewer retry counter ≥ 2 時，`{coderModel}` 強制升 opus，後續所有 Coder 派發皆用 opus
- Tier 2：Coder ↔ Tester retry 第 2 輪起升 opus

升級後不再降回 sonnet。理由：連 2 輪未過代表非表層瑕疵，sonnet 推理深度不足。

### Agent 上下文傳遞

Orchestrator **不應**將檔案內容貼入 agent prompt，而是傳入**變更名稱**，讓 agent 自行讀取變更 artifact：

```
openspec/changes/<name>/
├── proposal.md      # 目標與範圍
├── design.md        # 技術設計
├── tasks.md         # 任務清單
└── specs/           # delta specs
```

Agent 自行讀取所需的 artifacts，確保拿到的是檔案當前狀態，避免手動組裝遺漏。

**但前序 agent 的產出摘要必須由 orchestrator 傳遞**，因為 agent 之間無法直接溝通：

| 接收方 | 需要的前序產出 | 用途 |
|--------|--------------|------|
| Tester | Coder 的檔案清單 | 知道要讀哪些檔案、針對哪些模組撰寫測試 |
| Reviewer | Coder 的檔案清單 + 設計決策摘要 | 理解實作意圖，不只看「寫了什麼」 |
| Reviewer | Tester 的測試檔案清單 + 測試結果 | 判斷測試覆蓋度與品質 |
| Retry Coder | 前一輪 Coder 的輸出摘要 | 沿用設計決策，避免 context 斷裂 |

Orchestrator 負責保留每個 agent 的輸出摘要，在派發下一個 agent 時注入 prompt。

### Agent Knowledge Skills 載入

每個 agent 開始工作前，**必須先用 Skill tool 載入對應的 knowledge skills**，確保遵循專案慣例：

| Agent | 必須載入的 Skills | 額外 Skills | 用途 |
|-------|-----------------|------------|------|
| Coder（`/code:feat` 與 `/code:fix` 共用） | `code-guidelines`, `vue`, `vue-best-practices`, `nuxt`, `antfu` | 由 orchestrator 根據 task / 問題內容預判並寫入 prompt（如 `pinia`, `unocss`, `vite`, `vue-router-best-practices`, `vueuse-functions`, `pnpm`, `turborepo`）；Coder 實作中發現不足可自行補充載入 | `code-guidelines` 為**行為守則**（最小可行、外科手術式改動、自主判斷邊界），從生成端約束過度設計與越界改動；其餘為 Vue/Nuxt 開發慣例、程式碼風格、元件拆分守則。**兩個 pipeline 共用相同 skill 規範**，Tier 差異體現在流程（是否走 OpenSpec change / Reviewer），不在風格寬鬆度 |
| Tester | `vitest`, `antfu`, `vue-testing-best-practices` | — | 測試框架用法、Vue 元件測試慣例（describe/it、Vue Test Utils、Pinia 注入、Teleport） |
| Reviewer | `code-review` | 改動觸及 `.vue` 的 `<template>` / `<style>` 區塊或純樣式檔（`.css` / `.scss` / `.sass` / `.less`）時加 `web-design-guidelines`（補 UI/UX/a11y 檢查） | Review 標準、subagent prompt 模板、嚴重度與輸出格式的單一來源；Opus subagent 在執行時載入此 skill 取得規範 |
| 操作流程驗證 | `code-verify-flow` | 需 claude-in-chrome 瀏覽器工具（deferred 時 subagent 先 ToolSearch 批次載入） | 流程驗證判準精神、邊界、輸出格式的單一來源；觸及 UI/流程時派發，fresh-context subagent 載入取得規範 |
| 註解整理 | `code-comment` | — | 註解衛生判準、修正方式、輸出格式的單一來源；Sonnet subagent 收尾時載入取得規範 |

**Conditional skills 偵測方式**（orchestrator 在派發前先做）：
- `pnpm` → 讀 `package.json` 的 `packageManager` 欄位，或 `Glob pnpm-lock.yaml`
- `turborepo` → `Glob turbo.json`
- 其他 skills 依 task / 問題語意關鍵字判斷

### 分批策略

以 **Task 大項（T1、T2、T3…）** 為單位評估任務規模：

- **單一大項**：整批派發給一個 Coder Agent
- **多個大項**：每個大項為一批，獨立走 Coder → Tester 流程，全部完成後再跑一次完整 Reviewer
- **大項之間有依賴關係時**（如 T2 使用 T1 產出的模組），按依賴順序串行執行
- **大項之間無依賴時**，可平行派發

依賴判斷優先從 task 描述推斷。**若無法明確判斷，預設為串行執行（保守策略）。** 只有在 orchestrator 確信無依賴時才平行派發。

Task 大項本身對應 spec 的模組邊界，天然適合作為分批單位。不以 checkbox 數量切分，避免把同一模組的邏輯拆散到不同 agent。

**跨批 Context 注意事項**

串行執行時，後續批次的 Coder prompt 須額外包含：
- 前批產出的檔案清單
- 前批 Coder 的關鍵設計決策摘要

目的：確保後批 agent 沿用前批建立的介面與慣例，而非僅靠讀取原始碼推斷。

Retry 修復時，若修改涉及跨批共用的介面（如 composable 的回傳結構），orchestrator 應重跑受影響批次的測試。

### Coder Agent

**輸入**：變更的 design + tasks artifact
**Model**：預設 sonnet，符合「Coder Model 升級條件」時由 orchestrator 升 opus
**載入 Skills**：`code-guidelines`（行為守則，先讀再動手）, `vue`, `vue-best-practices`, `nuxt`, `antfu`（額外 skills 依 task 內容由 orchestrator 預判追加）
**職責**：
- 依照 tasks 撰寫實作代碼
- 每完成一項 task，更新 tasks.md 的 checkbox：`- [ ]` → `- [x]`
- 完成後自行跑專案 lint script（優先 `pnpm lint --fix`，依專案 package manager，不寫死 `npx`）
- 確保代碼通過 lint 後才交付

**輸出**：
1. 建立/修改/刪除的所有檔案路徑
2. 每個 task 的關鍵設計決策摘要（供 retry 及後續批次參考）
3. 更新後的 tasks.md

### Tester Agent

**輸入**：程式碼 + design.md（設計意圖）+ specs artifact（預期行為的 scenarios）
**載入 Skills**：`vitest`, `antfu`, `vue-testing-best-practices`
**職責**：
- 依照 vitest + antfu 慣例撰寫測試案例
- 使用 `describe`/`it` API 結構
- 測試檔放在與源碼同目錄（`foo.test.ts`）
- 執行測試
- 測試失敗時回報 Coder 修復

**排除規則**（不要撰寫以下測試）：
- TypeScript 型別/介面欄位存在性測試（TypeScript 編譯器已保證型別正確性，型別測試零價值）
- 無法 import 實際模組時（如 Nuxt composable），跳過該模組的單元測試，不要複製邏輯自測（複製邏輯自測無法驗證實際模組行為）

**輸出**：通過的測試套件

### Reviewer Agent

**職責**：透過 Task tool 派發 **Opus subagent**，一次完成 code quality + 安全性 + 專案慣例 + spec alignment + 整合輸出。Subagent 與主對話的 Sonnet context 隔離，確保「Sonnet 寫的 code 由獨立的 Opus subagent 審」，避免自評自審。

**載入 Skills**：`code-review`（改動觸及 `.vue` 的 `<template>` / `<style>` 區塊或純樣式檔時追加 `web-design-guidelines`）

**工作範圍**：
- 程式碼品質（命名、結構、可讀性、重複邏輯、過度抽象）
- 安全性（API key、XSS、注入、敏感資料）
- 專案慣例（繁體中文 UI、CSS 變數、設計系統、CLAUDE.md 規則）
- 測試品質（若有測試檔變更）
- Spec 一致性（對照 OpenSpec 變更 artifact 驗證 requirements / scenarios / design 決策）

**Adversarial 升級**：以下任一條件成立時，Reviewer prompt 帶入 `adversarial=true`，subagent 改採 red team 視角（主動找漏洞、攻擊面分析、質疑 happy path）：
- 改動觸及安全敏感路徑（auth、payment、API key、session）
- 改動含資料庫 schema / 生產資料遷移
- 第 2 輪 Reviewer retry 仍 FAIL（自動升級）
- 使用者明確要求

**輸出**：直接輸出 `code-review` skill 定義的最終格式（Spec Alignment 檢核表 + 問題清單 + SUGGESTION + 摘要 + PASS/FAIL/WARNING 判定）。Orchestrator 不再做後續包裝。

Review 維度、嚴重程度定義、輸出格式、subagent prompt 模板等細節見 `code-review` skill（`plugins/code/skills/code-review/SKILL.md`）。

### 註解整理 Agent

**職責**：開發收尾時清除 AI 在實作/修復過程累積的「註解垃圾」——過時/矛盾、疊加殘留、思考流程口吻、冗餘複述、註解掉的死碼、空泛 TODO。透過 Task tool 派發 **Sonnet subagent**，與主對話隔離取得 fresh-eyes 視角（剛寫完註解的人最難判斷哪些是廢話）。

**載入 Skills**：`code-comment`（判準、修正方式、輸出格式的單一來源）

**核心判準**：註解的價值在於補充「code 無法自我表達」的資訊。能從 code 直接讀出 → 冗餘可清；說明意圖/原因/陷阱 → 保留。**刪除是危險方向，拿不準就保留。**

**必須保留（不可誤刪）**：解釋「為什麼」的註解、公開 API 的 JSDoc/docstring、複雜演算法說明、功能型指令註解（`eslint-disable`、`@ts-expect-error`、`v-html` 安全註記等）、授權標頭、具體的 TODO/FIXME。

**行為**：與 `code-review`（report-only + STOP）不同，整理 Agent 依守則**直接套用 Edit**並自跑專案 lint script（優先 `pnpm lint --fix`，依專案 package manager 偵測，不寫死 `npx`），完成後回報改了什麼。註解改動風險低、不動 code 邏輯，故不需 Opus 重 review；orchestrator 在整理後**重跑測試**作為安全網（誤刪功能型指令註解會在此暴露）。

**位置**：
- Tier 3（`/code:feat`）：Reviewer PASS 後執行（retry 迴路全部 settle 後一次清最終狀態最乾淨）
- Tier 2（`/code:fix`）：Coder/Tester settle 後、Spec 影響檢查前

判準、subagent prompt 模板、輸出格式等細節見 `code-comment` skill（`plugins/code/skills/code-comment/SKILL.md`）。

### 操作流程驗證 Agent

**職責**：在真實瀏覽器裡把 spec 設計的使用者流程實際走一遍（真點擊、真填表、真跳頁），確認**流程串得起來、不報錯、不中斷**。透過 Task tool 派發 fresh-context subagent，載入 `code-verify-flow` skill 與 claude-in-chrome 瀏覽器工具，與寫 code 的 context 隔離——避免「自己寫的畫面自己驗」的自評盲點。

**與 Tester 的分工**：Tester 用 vitest 驗「每個零件的邏輯對不對」（靜態、mock、快）；本 Agent 驗「零件組起來會不會動」（真 dev server + 真點擊 + 真資料流）。mock 出來的測試天生驗不到「真接起來跑會不會斷」，這正是本 Agent 補的層，兩者互補不重疊。

**載入 Skills**：`code-verify-flow`（判準精神、邊界、輸出格式的單一來源）

**觸發條件**：改動觸及 user-facing 流程或畫面（如 `.vue` 的 `<template>`）才跑；純後端 / composable 改動、Tier 1 微調跳過。

**工作範圍（只驗 spec 明文寫的，其餘留給人）**：
- **流程層**：流程走得到終點 · 無 console `error` / 未捕捉 exception · 無未預期 network 4xx/5xx · 無卡死/白畫面/無限 loading
- **元件層**（只驗 spec 點名的關鍵元件）：存在 · 可見 · 可互動 · **spec 明文的位置**（粗粒度——落在對的區域或相對關係對，明顯跑錯/崩版才 FAIL）
- **console warning**：抓得到但分級——error/exception/5xx 視為 FAIL 信號；warning 回報但不 block

**絕不碰（← 開發者的判斷題）**：美感 / 間距 / 對齊 / 差幾 px、資料合理性、spec 沒寫的任何東西。**驗 spec 明文寫的一切；spec 沒寫的視覺與資料判斷一律留給人。**

**設計原則**：本 skill 刻意給「北極星 + 邊界」而非機械檢查表——職責邊界（什麼該驗/不碰）訂死，但「怎麼走、怎麼確認、灰色地帶怎麼拿捏」留給模型判斷。呼應自主優先：驗收依據含糊或「算不算壞」模稜兩可時，**描述現象、標待人確認**，不擅自放行也不擅自 block。

**verdict 與後續**：
- `PASS` → 進 Phase 3 人工驗收
- `FAIL`（流程斷 / error 信號 / spec 明文項目不成立）→ 回 Coder 修（最多 3 輪）
- `BLOCKED`（無法判定，**不計 retry**，報告須指明子原因）：
  - **工具未就緒**（Chrome 沒裝/沒連 claude-in-chrome）→ 優雅退化：跳過本關、退回純人工驗收，交付不卡死。**不當 FAIL**（沒工具 ≠ code 壞）、**不靜默放行**（別給假綠燈）
  - **環境**（dev server / seed data / 連不上）→ ⛔ 問人
  - **登入牆**（缺測試帳號 / 第三方 OAuth / SSO / CAPTCHA / 2FA / 魔術連結）→ ⛔ 問人；優先由呼叫方提供「已驗證入口」，避免 subagent 硬闖登入 UI

**前置檢查**：subagent 開工第一步先 preflight 確認瀏覽器工具連得上，連不上立刻判 BLOCKED 不進流程（避免一路撞牆）。登入牆處理與「絕不自創帳密 / 不用開發者本人帳號 / 帳密不外洩」等安全規則見 skill。

**位置**：排在 Reviewer 同層（可平行）、註解整理之前。

判準精神、subagent prompt 模板、輸出格式等細節見 `code-verify-flow` skill（`plugins/code/skills/code-verify-flow/SKILL.md`）。

### 失敗處理策略

```
ESLint 錯誤
  → Coder 自行修復（不計入重試次數）

測試失敗
  → Coder 修復 → Tester 重驗（最多 3 輪）
  → 修復 prompt 須附帶前一輪 Coder 輸出摘要（檔案清單 + 設計決策）
  → 修復 agent 不需重讀 design.md / specs/，只讀前輪摘要、失敗報告、要改的檔（節省重複 context 載入）

Review FAIL（有 CRITICAL）
  ├── 程式碼品質問題 → Coder 修復（最多 3 輪）
  ├── 測試品質問題 → Tester 修復（最多 3 輪）
  └── 安全性問題
      ├── 輕微 → Coder 修復
      └── 嚴重 → ⛔ 問人
  → 修復 agent 的 prompt 須附帶前一輪輸出摘要，避免 context 斷裂
  → 修復 agent 不需重讀 design.md / specs/，只讀前輪摘要、Review 報告、要改的檔

Review PASS with WARNING
  → WARNING 視為需修復，送回對應 agent
  → 同一歸屬的所有 WARNING 合併為一個修復任務（一次改完）
  → 問題歸屬：實作代碼 → Coder，測試代碼 → Tester
  → Coder 和 Tester 的修復任務若同時存在，可平行派發
  → 修復後的 re-check 使用 Sonnet model（非完整 Reviewer 流程）
  → re-check agent 載入 `code-review` skill，執行 targeted check 模式：只讀取改動的檔案和行數，驗證修復是否正確

操作流程驗證 FAIL（觸及 UI/流程時才跑）
  ├── 流程斷 / console error / spec 明文元件或位置不成立 → 回 Coder 修（最多 3 輪）
  │     → 修復 prompt 附前輪輸出摘要 + 驗證報告（走到哪斷了、哪個元件沒出現）
  │     → 修復後只 targeted re-run 受影響流程，不必重跑整套 Reviewer
  └── BLOCKED（無法判定，不計 retry；報告須指明子原因）
        ├── 工具未就緒（Chrome 沒裝/沒連 claude-in-chrome）
        │     → 優雅退化：跳過本關、退回純人工驗收，交付不卡死（非 FAIL、非靜默放行）
        ├── 環境（dev server 起不來 / seed data 不對 / 連不上）
        │     → ⛔ 問人（環境脆弱不該污染 retry 計數）
        └── 登入牆（缺測試帳號 / 第三方 OAuth / SSO / CAPTCHA / 2FA / 魔術連結）
              → ⛔ 問人；優先改用「已驗證入口」（dev session / seeded cookie / auth bypass），
                 別讓 subagent 硬闖登入 UI（脆弱且易觸發 dialog）

/opsx:verify 不通過（Phase 4）
  → 修復後重新驗證

Build 失敗
  → ⛔ 問人（通常是環境或整合問題）
```

**3 輪修不好代表問題可能比較嚴重，或是 AI 忽略了關鍵細節，必須停下來由人介入。**

---

## Phase 3: 人工驗收

### 目的

AI 的自動化測試和 code review 有盲點，特別是視覺化功能、互動體驗、資料合理性等面向。人工驗收是最終的品質關卡，確保功能在真實環境下正確運作。

**前置過濾器**：觸及 UI/流程的變更，Phase 2 尾端的「操作流程驗證 Agent」已先擋掉「流程根本走不通、報錯、明顯崩版」這類低級問題（見 Phase 2）。所以進到這裡時，人可以**專注在 AI 碰不了的判斷題**——視覺美感、版面細修、資料合理性、互動體驗好壞。操作流程驗證不取代人工驗收，只是縮小它要涵蓋的範圍。

### 步驟

1. AI 啟動 dev server
2. 人實際操作測試功能，驗證：
   - 視覺化呈現是否符合預期
   - 互動體驗是否流暢
   - 資料顯示是否合理
   - 整體功能在真實環境下的表現
3. 回報問題 → AI 回到 Coder 修復 → 重跑 Tester + Reviewer
4. 反覆直到人確認通過

### 規則

- **無重試次數限制** — 以人的判斷為準，必須修到對為止
- 人工驗收不通過時，AI 需根據回報的問題精確修復，不是重寫整個功能
- 驗收通過後才進入交付階段

---

## Phase 4: 交付

### 步驟

1. `/opsx:verify` — 完成度檢查（tasks 全勾、spec requirements 全實作、無殘留代碼）
2. `/opsx:sync` — 合併 delta spec 至主規格庫
3. `/opsx:archive` — 歸檔已完成的變更
4. Commit 文件（spec / archive）
5. Commit 代碼（實作 + 測試）
6. **Merge 回 main + 清理 worktree**（見下方步驟）
7. Push

### Branch 收尾步驟

```
1. 確認所有 commit 已在功能分支上
2. git checkout main
3. git merge <branch-name>                                ← merge 分支回 main
4. 如用 worktree：git worktree remove .claude/worktrees/<name>
5. 分支保留（不執行 git branch -d，保留歷史紀錄）
6. Push main
```

### Commit 規則

- 文件和代碼**分開 commit**
- Commit message 使用繁體中文
- Commit 前由 git hook 跑 ESLint（最終防線）

### 後續流程（依專案而定）

- 建立 PR（描述從變更 artifact 生成）
- CI 檢查（ESLint + tsc + build + test）
- Merge 策略與部署

---

## 分支與隔離策略

所有 Tier 2 / Tier 3 變更都在獨立 branch 上進行。Worktree 是**可選的額外隔離**，僅在需要並行開發時啟用。

### 隔離方式

| Tier | 預設 | 何時升級為 Worktree |
|------|------|---------------------|
| Tier 1 | 直接在 main 修改 | — |
| Tier 2 | Branch | — （不使用 worktree） |
| Tier 3 | Branch | 需要並行開發時（見下方判斷） |

### Worktree 啟用判斷（Tier 3）

| 情境 | 用 Branch | 用 Worktree |
|------|-----------|-------------|
| 只有一個進行中的 Tier 3 | ✓ | |
| 多個 Tier 3 需同時進行 | | ✓ |
| Tier 3 進行中，需同時做另一個 Tier 2/3 | | ✓ |
| 想保持主目錄隨時可做 Tier 1 | 也行（切 branch 即可） | ✓ 更方便 |

**簡單記法**：單線開發用 branch，多工並行用 worktree。

### 命名慣例

**Branch**：
- Tier 2：`fix-<描述>`（如 `fix-wind-mobile`）
- Tier 3：`feature-<描述>`（如 `feature-camera`）

**Worktree**（遵循 Claude Code 官方預設）：

| 項目 | 慣例 |
|------|------|
| 目錄位置 | `.claude/worktrees/<name>/` |
| 分支名稱 | `worktree-<name>` |
| 建立指令 | `claude --worktree <name>` |

### 並行開發（Worktree 模式）

多個 worktree 可同時存在，每個由獨立的 Claude Code 對話操作：

```
主目錄 (main) ← Tier 1 / Tier 2 隨時可做
│
├── .claude/worktrees/feature-camera/    ← Tier 3，Claude 對話 A
└── .claude/worktrees/feature-alert/     ← Tier 3，Claude 對話 B
```

**規則**：
1. 每個 Claude Code 對話操作一個 worktree，不跨 worktree 操作
2. 主目錄保持在 main，隨時可做 Tier 1 修改或 Tier 2 branch 開發
3. 先完成的先 merge，有衝突在 worktree 裡解
4. 多個 worktree 可能同時修改 `openspec/` 目錄，merge 時需留意 spec 衝突

### Worktree 生命週期

```
建立 worktree → 開發 → Commit → merge 回 main → 清理 worktree（保留分支）
```

- **清理**：`git worktree remove .claude/worktrees/<name>`

### 異常處理

| 狀況 | 處理 |
|------|------|
| Merge 衝突 | 在主目錄解衝突後 commit，再清理 worktree |
| 功能做到一半不要了 | 刪除分支（`git branch -D <name>`），如用 worktree 則一併清理 |
| Worktree 目錄殘留 | `git worktree prune` 清理孤立的 worktree 記錄 |

---

## Skill 架構設計

> **狀態：未來可選方向** — 目前不需要實作。現有架構已足夠：知識型 skills 透過 antfu/skills 安裝載入（vue、nuxt、antfu 等），流程型 commands 為專案自有的 code:feat / code:fix，SDD 流程由 OpenSpec 管理，專案慣例由 CLAUDE.md 統一管理。當 CLAUDE.md 放不下更多慣例、或各 agent SOP 需要獨立迭代維護時，再考慮拆分。

### 知識型 vs 流程型 vs 行為型分離

| 分類 | 來源 | 範例 | 回答的問題 |
|------|------|------|-----------|
| 知識型 skills | antfu/skills（外部安裝） | vue、nuxt、vitest、antfu、vue-best-practices | 「怎麼寫 Vue/Nuxt」 |
| 流程型 commands/skills | 專案自有 | code:decisions（動手前決策收斂）、code:feat（Tier 3 Pipeline）、code:fix（Tier 2 Pipeline）、code:review（獨立 Review）、code:verify-flow（操作流程驗證）、code:comment（註解整理） | 「照什麼步驟跑」 |
| 行為型 skills | 專案自有 | code-guidelines（Coder 行為守則） | 「寫的當下怎麼自我約束」 |
| SDD 流程指令 | OpenSpec | explore、propose、apply、verify、sync、archive | 「變更怎麼管理」 |

### 原則

- 每個 agent 載入相關的 knowledge skill + 自己的 workflow skill + 適用的 behavioral skill
- 專案慣例統一寫成 knowledge skill，所有 agent 共享
- Knowledge skill 描述「怎麼寫」，workflow skill 描述「照什麼步驟做」，behavioral skill 描述「寫的當下怎麼自我約束」
- 行為型與審查型同源配對：`code-guidelines`（生成端自律）與 `code-review`（審查端把關）檢查同一組性質（過度設計、只改必要），一個在 Coder 端預防、一個在 Reviewer 端攔截

---

## ESLint 三層防線

| 層級 | 時機 | 負責者 |
|------|------|--------|
| 第一層 | Coder 完成代碼後 | Coder Agent |
| 第二層 | Git commit 時 | Git pre-commit hook |
| 第三層 | PR / CI 時 | GitHub Actions（依專案） |

### 指令執行慣例（lint / test 共用）

所有 agent（Coder / Tester / 註解整理）執行 lint 與 test 時，**指令依專案偵測，不寫死裸 `npx`**：

1. 讀 `package.json` 的 `scripts` 與 `packageManager` 欄位（或 root lockfile：`pnpm-lock.yaml` / `yarn.lock` / `package-lock.json`）判定 package manager
2. **優先用專案既有 script**（如 `pnpm lint --fix`、`pnpm test`）——尊重專案在 script 裡設定的旗標與設定檔
3. 無對應 script 才 fallback 到本地 binary（`pnpm exec eslint --fix` / `pnpm exec vitest run`，依偵測到的 PM）
4. 避免裸 `npx`：可能觸發下載或用到與專案不符的版本

Tester 需要逐項失敗資訊時，可用 `pnpm exec vitest run --reporter=verbose`（依偵測到的 PM 調整）。
