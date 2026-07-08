# AI 開發 Pipeline 設計

> **文件權威層級**：各 `SKILL.md` 為**執行契約權威**（runtime 只載入 SKILL.md；條文衝突時以它為準，並視為文件 bug 回報修正）＞ 本文件為**方法論**（解釋設計理由與整體流程）＞ README 為**摘要**（導覽）。

## 目標

設計一套完整的 AI 輔助開發流程，在設計文件完成後，AI 透過專業分工的 agent pipeline 自動完成實作、測試、審查與交付。

本流程採**變更分級制度**，依影響範圍選擇對應流程，避免小改動承受完整 Pipeline 的文件負擔。**無論哪個等級，Spec 都必須保持同步** — 這是 SDD（Spec-Driven Development）的核心原則。

## 工具依賴

新專案啟動只需安裝以下三樣：

| 工具 | 來源 | 職責 |
|------|------|------|
| **OpenSpec**（建議安裝） | [OpenSpec](https://github.com/Fission-AI/OpenSpec) | SDD 變更管理：explore、propose、apply、verify、sync、archive |
| **antfu/skills** | [github.com/antfu/skills](https://github.com/antfu/skills) | 知識型 skills：vue、nuxt、vitest、antfu、vue-best-practices 等 |
| **srun:decisions / srun:feat / srun:fix / srun:review / srun:verify-flow / srun:comment / srun:retro** | 專案自有 skills | 流程型：動手前決策收斂（`/srun:decisions`）、Tier 3 三角色 Pipeline（`/srun:feat`）、Tier 2 輕量 Pipeline（`/srun:fix`）、獨立 Code Review（`/srun:review`）、操作流程驗證（`/srun:verify-flow`）、註解整理（`/srun:comment`）、回饋迴路（`/srun:retro`——記錄模式自動、`--archive` 消化收件匣產出 kit 優化提案） |
| **claude-in-chrome**（操作流程驗證用） | Claude Code 內建瀏覽器工具 | 讓操作流程驗證 Agent 在真瀏覽器實際點擊走完 spec 流程；僅觸及 UI/流程的變更才用到 |

---

## 變更分級

所有變更依影響範圍分為三個等級，選擇對應流程。

### 判斷標準

主判準是**決策狀態**與**是否需要新的 OpenSpec artifact**；檔案數只是輔助訊號，不是門檻。

| 考量 | Tier 1 微調 | Tier 2 小改動 | Tier 3 完整功能 |
|------|------------|--------------|----------------|
| 決策狀態 | 瑣碎，無需決策 | 決策已在對話收斂（微決策 1-2 題可當場定案再派發） | 決策分支多，需完整收斂流程（explore / decisions / propose） |
| 需要新的 OpenSpec artifact | 否 | 否（驗收修正場景可回寫**既有** change） | 是（新增 API/元件、行為值得規格化、變更需拆批） |
| 影響檔案數（輔助訊號） | 通常 1-2 個 | 通常 2-5 個 | 通常 5+ 或跨模組 |
| 範例 | CSS 微調、文字修正、單行 bug fix | 跨檔案 bug fix、小型 UI 調整、composable 微調、Tier 3 驗收後的小修正 | 新功能、大型重構、架構變更 |

**Tier 2 定位一句話**：「對話定案、乾淨執行、快速人工驗證」的執行品質層——品質高於主對話直改（fresh-context Coder 載守則＋Tester＋branch 隔離），重量低於 feat 驗證鏈（無 Reviewer、無操作流程驗證）。

**三層哲學統一**：全部 spec 先行，差別只在儀式重量——Tier 3 完整 artifact／Tier 2 派發前直改 spec 庫／Tier 1 末端檢查兜底。

### 流程總覽

```
收到需求 → 判斷 Tier
  ├─ Tier 1 (微調)
  │    主目錄直接修改 → ESLint --fix → 人工確認 → Spec 影響檢查 → Commit
  │
  ├─ Tier 2 (小改動)
  │    對話定案 → 建立 branch → Spec 影響判斷（有影響先改 spec）→ Coder + Tester
  │    → 註解整理 → Spec 輕量複核 → 人工確認 → Commit → merge 回 main
  │
  └─ Tier 3 (完整功能)
       /opsx:explore → 建立 branch（或 worktree）→〔決策分支多時〕/srun:decisions → /opsx:propose
       → /srun:feat（Coder→Tester→Reviewer∥操作流程驗證→註解整理）→ /opsx:verify → /opsx:sync → /opsx:archive → merge 回 main
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

**定位**：「對話定案、乾淨執行、快速人工驗證」的執行品質層。適用：決策已在對話收斂、不需建立新的 OpenSpec artifact 的改動——跨檔案 bug fix、小型 UI 調整、composable 微調、行為微調、Tier 3 驗收後的小修正。

兩種進入場景：**(i) 獨立小功能／改動**（主對話討論定案後派發）；**(ii) 進行中 change 的驗收修正**（問題不大到重跑 Tier 3、但有決策且要品質；不讀 Tier 3 執行狀態，retry counter 與 model 棘輪歸零重起）。

```
對話定案（微決策 1-2 題可當場收斂）
  → 建立 branch (git checkout -b fix-<描述>)
  → Spec 影響判斷（spec-first：場景 i 有影響先改 openspec/specs/；
     場景 ii 影響在 spec/design 層先回寫 change artifact；純實作問題直接派發）
  → Coder (Sonnet/Opus，prompt 注入更新後的 spec 段落作為驗收依據) + Tester (Sonnet)
  →〔安全敏感路徑時〕adversarial Opus review（與 Coder 升 Opus 同一訊號聯動）
  → 註解整理 (Sonnet)
  → Spec 輕量複核（防實作範圍外溢）
  → 人工確認
  → Commit（在 fix branch 上，Spec 與 code 同 commit）
  → merge 回 main
```

透過 `/srun:fix` 進入（skill 位於 `plugins/srun/skills/fix/SKILL.md`）。

- **在獨立 branch 中開發**（不使用 worktree，改動範圍小不需目錄隔離）
- 不建立新的 OpenSpec artifact（不建 proposal / design / tasks；場景 ii 可回寫既有 change artifact）
- **保留 Coder + Tester**（品質保證）
- 跳過 Reviewer（變更範圍小，不需多視角審查）；**例外：安全敏感路徑**——Coder 升 Opus 時聯動補一次 adversarial Opus review（Tester 通過後、註解整理前）。分級管的是流程重量，不分掉安全底線
- Coder 與 Tester 的執行規則同 Tier 3（載入 skills、lint + typecheck 自修、失敗重試最多 3 輪、修復後自跑三件套）
- Coder model 預設 sonnet；改動觸及安全敏感路徑，或升級模式開啟後（任一迴路進入第 2 輪修復），修復派發升 opus（統一規則，見「Model 分層策略」）
- Tester 的「無法測試清單」非空且模組被頁面使用 → 受影響頁面清單寫進人工確認報告（Tier 2 不派 verify-flow，給人爆炸半徑資訊）
- **Spec 影響判斷前移到派發前**（spec-first），commit 前僅做一行輕量複核（見下方共用流程）

---

## Spec 影響檢查（Tier 1 & Tier 2）

SDD 核心原則：**Code 和 Spec 永遠在同一個 commit 裡，不允許「程式改了但文件沒跟上」的狀態。** 三層 Tier 哲學統一——全部 spec 先行，差別只在儀式重量：Tier 3 完整 artifact、Tier 2 派發前直改 spec 庫、Tier 1 末端檢查兜底。

### Tier 2（spec-first，派發前判斷）

`/srun:fix` 在派發 Coder **之前**先做 Spec 影響判斷：場景 (i) 有影響先更新 `openspec/specs/`；場景 (ii) 影響在 spec/design 層先回寫 change artifact；更新後的 spec 段落作為驗收依據注入派發 prompt（Coder 拿權威版驗收依據、Tester 稽核有 ground truth）。commit 前另做一行**輕量複核**防實作範圍外溢。細節見 `fix` SKILL Step 3 / Step 7。

### Tier 1（commit 前檢查）

```
1. 列出本次修改的所有檔案
2. 比對以下位置的相關規格：
   - openspec/specs/    （OpenSpec 主規格庫）
   - 專案 CLAUDE.md 中定義的其他設計文件位置
3. 判斷：
   ├─ 無影響 → 直接 commit
   └─ 有影響 → 更新對應 spec → Code + Spec 一起 commit
```

### 常見情境

| 修改內容 | 可能影響的 Spec |
|----------|----------------|
| 業務邏輯閾值 / 規則調整 | `openspec/specs/` 中對應的行為規格 |
| CSS 變數修改 | 專案 CLAUDE.md 定義的設計系統文件 |
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
  →〔決策分支多時〕/srun:decisions（動手前收斂未定決策，可選）
  → /opsx:propose（一步完成 proposal → specs → design → tasks）
  產出：proposal + specs + design + tasks（在功能分支上）

Phase 2: 自動化實作
  Coder (Sonnet/Opus) → Tester (Sonnet)
    → Reviewer (Opus subagent) ∥ 操作流程驗證 (Sonnet subagent，觸及 UI/流程時)
    → 註解整理 (Sonnet)

Phase 3: 人工驗收
  人實際操作測試功能
  有問題 → 小修正走 /srun:fix 場景 (ii)（spec/design 層先回寫 change artifact）
         → 問題大到動設計 → 調整 spec/design 後重跑 feat
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
   - **預設用 branch**：`git checkout -b feat/<change-name>`
   - **需要並行開發時用 worktree**：`claude --worktree <change-name>`（見下方「分支與隔離策略」）
   - 確保後續的變更 artifact 和實作代碼在同一個分支上
3. **Decisions（動手前決策收斂，決策分支多時）**
   - 使用 `/srun:decisions`
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

- `/srun:feat` — Pipeline 版本，派發專職 agent 分工執行（Coder → Tester → Reviewer）
- `/opsx:apply` — 單一 agent，主對話直接實作所有 tasks

需要嚴謹流程時用 `/srun:feat`（推薦），簡單任務可用 `/opsx:apply`。

### Agent Pipeline

三個專業 agent 依序執行，形成串行 pipeline：

```
💻 Coder (Sonnet/Opus)
  │  讀取 design + tasks
  │  撰寫實作代碼（允許順手寫自證測試，輸出列出）
  │  完成後跑專案 lint script + typecheck（自修不計入重試次數）
  │
  ▼
🧪 Tester (Sonnet) — 獨立稽核者
  │  ①先讀 spec 獨立列「應驗證行為清單」（此階段禁看任何測試檔，防錨定）
  │  ②對照既有測試找缺口與錯斷言 → ③補寫/修正 → ④跑測試（scoped 收斂→收尾全量）
  │  失敗 → 回 Coder 修復（最多 3 輪；Coder 可引驗收依據原文申辯 test-defect
  │         → 改派 Tester 修測試，上訴輪照計 counter）
  │
  ▼
🔍 Reviewer（Opus subagent）
  │  Task tool 派發 Opus subagent，與主對話 Sonnet 隔離
  │  code quality + 安全性 + 慣例 + spec alignment + 整合輸出
  │  安全敏感路徑 / 升級模式開啟後重派 → adversarial
  │  FAIL → 修復（settle 前自跑三件套 lint+typecheck+test）→ 重審（最多 3 輪）
  │
  ▼  Reviewer 迴路完全 settle（含 targeted re-check）後才派發下一關
🖱️ 操作流程驗證（Sonnet subagent，觸及 UI/流程時才跑；永遠壓軸的動態關卡）
  │  Task tool 派發 fresh-context subagent，載入
  │  verify-flow + claude-in-chrome 瀏覽器工具
  │  真點擊走完 spec 流程：不報錯/不中斷 + spec 明文元件與位置
  │  FAIL（重現確認後）→ 回 Coder：修復 → 三件套 → review targeted re-check
  │         → verify targeted re-run（最多 3 輪）
  │  BLOCKED（環境）→ ⛔ 問人；flaky（重現不出）→ 標註交人工驗收，不計 retry
  │
  ▼
🧹 註解整理（Sonnet subagent）
     所有 gate settle 後執行，載入 comment
     清除過時 / 疊加 / 思考流程 / 冗餘註解，保留 why 與功能型指令
     直接套用 Edit → lint --fix（專案 script）→ orchestrator 重跑測試作安全網
```

> **Gate 排序原則（序列化）**：**靜態關卡（測試＋review）跟著每一次修復重新蓋章；動態關卡（操作流程驗證）永遠壓軸，驗的必是最終 code。** 操作流程驗證在 Reviewer 迴路完全 settle 後才派發——它的 PASS 因此不可能過期，不需要任何「綠燈作廢」規則；其 FAIL 的修復也走完整靜態關卡（三件套＋targeted re-check）後才 targeted re-run。取捨：快樂路徑 wall-clock 由 max(review, verify) 變為相加——自主 pipeline 無人即時盯梭，wall-clock 是最便宜的貨幣，規則才是永久 drift 面。**註解整理必須排在所有 gate 之後**——它只動註解不動邏輯，跑一次清最終狀態最乾淨；且純註解改動不會弄壞走得通的流程（有「整理後重跑測試」當安全網），所以驗證永遠不需因註解整理而重跑。判準、subagent prompt、輸出格式見 `verify-flow` skill。

### Orchestrator

負責派發 agent、判斷結果、決定 retry 或繼續的角色。

> **現狀**：由主對話（人 + Claude）手動調度，流程已實測可行，但調度邏輯尚未標準化為 skill 或腳本。

### Model 分層策略

| Agent | Model | 理由 |
|-------|-------|------|
| Coder | Sonnet（預設）/ Opus | 預設 sonnet：實作代碼足夠，速度快、成本低，且 Tester + Opus Reviewer + retry 已能接住表層瑕疵。先驗上需深度推理（架構變更、安全敏感路徑、設計決策密集）或 retry 卡關時升 opus（見下方「Coder Model 升級條件」） |
| Tester | Sonnet | 撰寫測試不需最強推理 |
| Reviewer | Opus | 以 `opus-reviewer` plugin agent 派發（frontmatter 鎖 model 與工具白名單、報告首行自報實際 model）；同時兼顧 code quality、安全性、慣例、spec alignment 與整合輸出。Subagent context 與主對話 Sonnet 隔離，提供獨立視角避免自評自審；Opus 推理深度也適合對抗 review |
| Reviewer (WARNING re-check) | Sonnet | 小範圍 re-check 不需 Opus，由 Sonnet subagent 跑 `review` 的 targeted check 即可 |
| 操作流程驗證 | Sonnet | 走瀏覽器流程屬操作性工作，Sonnet 足夠；fresh-context subagent 與主對話隔離取得獨立視角，避免自評自審 |
| 註解整理 | Sonnet | 收尾清理註解，載入 `comment`；判定屬機械性偏多不需 Opus，subagent 隔離取得 fresh eyes |

#### Coder Model 升級條件

Coder 預設 sonnet，orchestrator 在派發前判定是否升 opus。判定保守 — 一般任務（spec 明確、單模組、無安全顧慮）維持 sonnet。

**Tier 3（`/srun:feat`）首次派發升級**（任一成立）：
- 架構變更 / 大型重構：跨多個模組邊界，或修改既有公開 interface（composable 回傳結構、store API、共用型別）
- 安全敏感路徑：auth、payment、API key 處理、session 管理（與 adversarial 判定共用條件）
- 設計決策密集：design.md 將較多實作方式留給 Coder 自行決定

**Tier 2（`/srun:fix`）首次派發升級**：Tier 2 依定義為單模組、無設計決策的小改動，故僅保留「安全敏感路徑」一條。

**Retry 動態升級（統一規則）**：**任一迴路進入第 2 輪修復即開啟「升級模式」——全 pipeline 單一開關，開啟後不關閉。** 此後所有修復派發一律升 Opus（不論被派的是 Coder 或 Tester——上訴輪的修復派發可能是 Tester 修測試，同一訊號對誰被派去修都成立）、Opus Reviewer 重派一律帶 adversarial、免重讀限制解除。Tier 2、Tier 3 一體適用；targeted re-check／re-run 是驗證派發，維持 Sonnet 不受影響。

升級後不再降回 sonnet（棘輪）。理由：連 2 輪未收斂代表非表層瑕疵，sonnet 推理深度不足；且用全 pipeline 單一開關取代逐迴路分帳，orchestrator 只需維護一個布林狀態——升級訊號出現後多花的 Opus 呼叫是便宜貨幣，記帳規則的複雜度才是永久 drift 面。升 Opus 同時**解除「retry 免重讀 design/specs」限制**（解禁非強制——Opus 自行判斷要不要讀、讀哪份），判定需要深度推理的同時給足材料。

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
| Coder（`/srun:feat` 與 `/srun:fix` 共用） | `guidelines`, `vue`, `vue-best-practices`, `nuxt`, `antfu` | 由 orchestrator 根據 task / 問題內容預判並寫入 prompt（如 `pinia`, `unocss`, `antfu-design`, `vite`, `vue-router-best-practices`, `vueuse-functions`, `nitro`, `pnpm`, `turborepo`）；Coder 實作中發現不足可自行補充載入 | `guidelines` 為**行為守則**（最小可行、外科手術式改動、自主判斷邊界），從生成端約束過度設計與越界改動；其餘為 Vue/Nuxt 開發慣例、程式碼風格、元件拆分守則。**兩個 pipeline 共用相同 skill 規範**，Tier 差異體現在流程（是否走 OpenSpec change / Reviewer），不在風格寬鬆度 |
| Tester | `vitest`, `antfu`, `vue-testing-best-practices` | — | 測試框架用法、Vue 元件測試慣例（describe/it、Vue Test Utils、Pinia 注入、Teleport） |
| Reviewer | `review` | 改動觸及 `.vue` 的 `<template>` / `<style>` 區塊或純樣式檔（`.css` / `.scss` / `.sass` / `.less`）時加 `web-design-guidelines`（補 UI/UX/a11y 檢查）；以 UnoCSS 建構 UI 時加 `antfu-design`（設計慣例／token 遵循）；觸及 Nuxt/Nitro server 端時加 `nitro`（route rules／快取／event handler 慣例） | Review 標準、subagent prompt 模板、嚴重度與輸出格式的單一來源；由 **orchestrator 載入**、展開其模板注入 opus-reviewer subagent（prompt 已內含完整規範，subagent 只載入呼叫方指定的追加 skills） |
| 操作流程驗證 | `verify-flow` | 需 claude-in-chrome 瀏覽器工具（deferred 時 subagent 先 ToolSearch 批次載入） | 流程驗證判準精神、邊界、輸出格式的單一來源；觸及 UI/流程時派發。由 **orchestrator 載入**本 skill、展開其 subagent prompt 模板後注入 fresh-context subagent（subagent 不自行載入 skill） |
| 註解整理 | `comment` | — | 註解衛生判準、修正方式、輸出格式的單一來源；由 **orchestrator 於收尾時載入**本 skill、展開 prompt 模板注入 Sonnet subagent（subagent 不自行載入 skill） |

**Conditional skills 偵測方式**（orchestrator 在派發前先做）：
- `pnpm` → 讀 `package.json` 的 `packageManager` 欄位，或 `Glob pnpm-lock.yaml`
- `turborepo` → `Glob turbo.json`
- `nitro` → 改動觸及 `server/` 下 API routes／event handlers、`nitro.config`、`routeRules`、server 快取／tasks／websocket、部署 preset（`nuxt` 管框架整合面，`nitro` 補 server 引擎細節）
- `antfu-design` → 以 UnoCSS 建構／重構 UI 介面（semantic token、雙主題、視覺樣式、micro-interaction；`unocss` 管 rule 語法，`antfu-design` 管設計慣例與 token 命名）
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
**載入 Skills**：`guidelines`（行為守則，先讀再動手）, `vue`, `vue-best-practices`, `nuxt`, `antfu`（額外 skills 依 task 內容由 orchestrator 預判追加）
**職責**：
- 依照 tasks 撰寫實作代碼（允許順手寫自證測試；正式測試設計與稽核由 Tester 負責）
- 每完成一項 task，更新 tasks.md 的 checkbox：`- [ ]` → `- [x]`
- 完成後自行跑專案 lint script（優先 `pnpm lint --fix`）與 typecheck（優先專案 `typecheck` script；Nuxt 用 `pnpm exec nuxi typecheck`），依專案 package manager，不寫死 `npx`
- 確保代碼通過 lint + typecheck 後才交付（自修不計 retry）

**輸出**：
1. 建立/修改/刪除的所有檔案路徑
2. 每個 task 的關鍵設計決策摘要（供 retry 及後續批次參考）
3. 順手寫的測試檔路徑（若有，供 Tester 稽核）
4. 更新後的 tasks.md

### Tester Agent

**輸入**：程式碼 + design.md（設計意圖）+ specs artifact（預期行為的 scenarios）
**載入 Skills**：`vitest`, `antfu`, `vue-testing-best-practices`
**角色**：**獨立稽核者**——價值不是「跑一遍看綠紅」，而是從 spec 獨立推導應驗行為，抓出「Coder 的誤解同時寫進 code 和測試然後全綠」的假信心。
**職責（工作順序，防錨定）**：
- ① 先讀 specs scenarios，獨立列出「應驗證行為清單」（此階段禁看任何測試檔，含 Coder 順手寫的）
- ② 對照既有測試找缺口與錯誤斷言 → ③ 補寫缺的、修正錯的（依 vitest + antfu 慣例、`describe`/`it` 結構、測試檔與源碼同目錄）
- ④ 依守則檔的執行節奏跑測試（scoped 收斂、收尾全量蓋章）輸出報告；測試失敗時回報 Coder 修復

**排除規則**（不要撰寫以下測試）：
- TypeScript 型別/介面欄位存在性測試（typecheck gate 已保證型別正確性，型別測試零價值）

**Nuxt composable 測試策略（三層，依序）**：
1. 純邏輯抽為獨立模組（結構層優先），測 import 實際模組
2. 殘餘 Nuxt runtime 依賴：偵測 `@nuxt/test-utils` 已裝即用它直接測（`@vitest-environment nuxt` 只標需要重環境的測試檔）；kit 永不主動安裝依賴
3. 未裝才跳過＋輸出「無法測試的模組清單」——清單有消費者：Tier 3 觸發 verify-flow 的 OR 條件、Tier 2 寫進人工確認報告（警訊不漏接）

**輸出**：通過的測試套件

### Reviewer Agent

**職責**：透過 Task tool 以 **`opus-reviewer` plugin agent** 派發（`plugins/srun/agents/opus-reviewer.md`——frontmatter 鎖 `model: opus` 與工具白名單：無 Write/Edit 的 report-only 門檻、保留 Bash 供自跑 `git diff`；報告第一行自報實際 model 作 runtime 降級偵測），一次完成 code quality + 安全性 + 專案慣例 + spec alignment + 整合輸出。Subagent 與主對話的 Sonnet context 隔離，確保「Sonnet 寫的 code 由獨立的 Opus subagent 審」，避免自評自審。

**規範來源**：`review`（由 orchestrator 展開其模板注入 prompt，subagent 不自行載入；改動觸及 `.vue` 的 `<template>` / `<style>` 區塊或純樣式檔時追加 `web-design-guidelines`，由 subagent 載入）

**工作範圍**：
- 程式碼品質（命名、結構、可讀性、重複邏輯、過度抽象）
- 安全性（API key、XSS、注入、敏感資料）
- 專案慣例（CLAUDE.md 定義的 UI 語言慣例、CSS 變數、設計系統等規則）
- 測試品質（若有測試檔變更）
- Spec 一致性（對照 OpenSpec 變更 artifact 驗證 requirements / scenarios / design 決策）

**Adversarial 升級**：以下任一條件成立時，Reviewer prompt 帶入 `adversarial=true`，subagent 改採 red team 視角（主動找漏洞、攻擊面分析、質疑 happy path）：
- 改動觸及安全敏感路徑（auth、payment、API key、session）
- 改動含資料庫 schema / 生產資料遷移
- 升級模式開啟後重派（任一迴路進入第 2 輪修復，自動升級）
- 使用者明確要求

**輸出**：直接輸出 `review` skill 定義的最終格式（Spec Alignment 檢核表 + 問題清單 + SUGGESTION + 摘要 + PASS/FAIL/WARNING 判定）。Orchestrator 不再做後續包裝。

Review 維度、嚴重程度定義、輸出格式、subagent prompt 模板等細節見 `review` skill（`plugins/srun/skills/review/SKILL.md`）。

### 註解整理 Agent

**職責**：開發收尾時清除 AI 在實作/修復過程累積的「註解垃圾」——過時/矛盾、疊加殘留、思考流程口吻、冗餘複述、註解掉的死碼、空泛 TODO。透過 Task tool 派發 **Sonnet subagent**，與主對話隔離取得 fresh-eyes 視角（剛寫完註解的人最難判斷哪些是廢話）。

**載入 Skills**：`comment`（判準、修正方式、輸出格式的單一來源）

**核心判準**：註解的價值在於補充「code 無法自我表達」的資訊。能從 code 直接讀出 → 冗餘可清；說明意圖/原因/陷阱 → 保留。**刪除是危險方向，拿不準就保留。**

**必須保留（不可誤刪）**：解釋「為什麼」的註解、公開 API 的 JSDoc/docstring、複雜演算法說明、功能型指令註解（`eslint-disable`、`@ts-expect-error`、`v-html` 安全註記等）、授權標頭、具體的 TODO/FIXME。

**行為**：與 `review`（report-only + STOP）不同，整理 Agent 依守則**直接套用 Edit**並自跑專案 lint script（優先 `pnpm lint --fix`，依專案 package manager 偵測，不寫死 `npx`），完成後回報改了什麼。註解改動風險低、不動 code 邏輯，故不需 Opus 重 review；orchestrator 在整理後**重跑測試**作為安全網（大多數誤刪功能型指令註解會在此暴露；build-time pragma（`@__PURE__`、`webpackChunkName` 等）除外——測試驗不到，靠 `comment` 保護清單防守）。

**位置**：
- Tier 3（`/srun:feat`）：Reviewer PASS 後執行（retry 迴路全部 settle 後一次清最終狀態最乾淨）
- Tier 2（`/srun:fix`）：Coder/Tester settle 後、Spec 影響檢查前

判準、subagent prompt 模板、輸出格式等細節見 `comment` skill（`plugins/srun/skills/comment/SKILL.md`）。

### 操作流程驗證 Agent

**職責**：在真實瀏覽器裡把 spec 設計的使用者流程實際走一遍（真點擊、真填表、真跳頁），確認**流程串得起來、不報錯、不中斷**。透過 Task tool 派發 fresh-context subagent，載入 `verify-flow` skill 與 claude-in-chrome 瀏覽器工具，與寫 code 的 context 隔離——避免「自己寫的畫面自己驗」的自評盲點。

**與 Tester 的分工**：Tester 用 vitest 驗「每個零件的邏輯對不對」（靜態、mock、快）；本 Agent 驗「零件組起來會不會動」（真 dev server + 真點擊 + 真資料流）。mock 出來的測試天生驗不到「真接起來跑會不會斷」，這正是本 Agent 補的層，兩者互補不重疊。

**載入 Skills**：`verify-flow`（判準精神、邊界、輸出格式的單一來源）

**觸發條件**：改動觸及 user-facing 流程或畫面（如 `.vue` 的 `<template>`、頁面/路由/互動流程變更）才跑；**OR 條件**——Tester「無法測試清單」非空且模組被頁面使用（grep）→ 純 composable 改動也強制觸發，受影響頁面注入 prompt 做 targeted 驗證。純樣式 changeset、純後端/純邏輯（未觸發 OR）、Tier 1 微調跳過。

**工作範圍（只驗 spec 明文寫的，其餘留給人）**：
- **流程層**：流程走得到終點 · 無 console `error` / 未捕捉 exception · 無未預期 network 4xx/5xx · 無卡死/白畫面/無限 loading
- **元件層**（只驗 spec 點名的關鍵元件）：存在 · 可見 · 可互動 · **spec 明文的位置**（粗粒度——落在對的區域或相對關係對，明顯跑錯/崩版才 FAIL）
- **console warning**：抓得到但分級——error/exception/5xx 視為 FAIL 信號；warning 回報但不 block

**絕不碰（← 開發者的判斷題）**：美感 / 間距 / 對齊 / 差幾 px、資料合理性、spec 沒寫的任何東西。**驗 spec 明文寫的一切；spec 沒寫的視覺與資料判斷一律留給人。**

**設計原則**：本 skill 刻意給「北極星 + 邊界」而非機械檢查表——職責邊界（什麼該驗/不碰）訂死，但「怎麼走、怎麼確認、灰色地帶怎麼拿捏」留給模型判斷。呼應自主優先：驗收依據含糊或「算不算壞」模稜兩可時，**描述現象、標待人確認**，不擅自放行也不擅自 block。

**verdict 與後續**：
- `PASS` → 進 Phase 3 人工驗收
- `FAIL`（流程斷 / error 信號 / spec 明文項目不成立；**判 FAIL 前必重現一次**，視覺型 FAIL 附截圖或幾何描述）→ 回 Coder 修（最多 3 輪；修復走完整靜態關卡再 targeted re-run）
- **flaky**（一次性錯誤、重現不出）→ 不打回 Coder、不計 retry，標註進報告交人工驗收確認（不靜默判 PASS）
- `BLOCKED`（無法判定，**不計 retry**，報告須指明子原因）：
  - **工具未就緒**（Chrome 沒裝/沒連 claude-in-chrome）→ 優雅退化：跳過本關、退回純人工驗收，交付不卡死。**不當 FAIL**（沒工具 ≠ code 壞）、**不靜默放行**（別給假綠燈）
  - **環境**（dev server / seed data / 連不上）→ ⛔ 問人
  - **登入牆**（缺測試帳號 / 第三方 OAuth / SSO / CAPTCHA / 2FA / 魔術連結）→ ⛔ 問人；優先由呼叫方提供「已驗證入口」，避免 subagent 硬闖登入 UI

**前置檢查**：subagent 開工第一步先 preflight 確認瀏覽器工具連得上，連不上立刻判 BLOCKED 不進流程（避免一路撞牆）。登入牆處理與「絕不自創帳密 / 不用開發者本人帳號 / 帳密不外洩」等安全規則見 skill。

**位置**：排在 **Reviewer 迴路完全 settle 之後**、註解整理之前——動態關卡永遠壓軸，驗的必是最終 code。

判準精神、subagent prompt 模板、輸出格式等細節見 `verify-flow` skill（`plugins/srun/skills/verify-flow/SKILL.md`）。

### 失敗處理策略

```
ESLint / typecheck 錯誤
  → Coder 自行修復（不計入重試次數）

測試失敗
  → Coder 修復（最多 3 輪）：settle 前自跑三件套（lint + typecheck + test），
    全綠即 settle，不重派 Tester（修復後防的是機械回歸，跑套件即可偵測）
  → 修復 prompt 須附帶前一輪 Coder 輸出摘要（檔案清單 + 設計決策）
  → 修復 agent 不需重讀 design.md / specs/（升 Opus 輪解除），只讀前輪摘要、失敗報告、要改的檔
  → Coder 判斷「測試與驗收依據不符」→ 引驗收依據原文申辯 test-defect（引不出原文不受理）
    → 改派 Tester 修測試（測試檔守護者一律是 Tester）；上訴輪照計 counter

Review FAIL（有 CRITICAL）
  ├── 程式碼品質問題 → Coder 修復（最多 3 輪）
  ├── 測試品質問題 → Tester 修復（最多 3 輪）
  └── 安全性問題
      ├── 輕微 → Coder 修復
      └── 嚴重 → ⛔ 問人
  → 修復 agent 的 prompt 須附帶前一輪輸出摘要，避免 context 斷裂
  → 修復 agent 不需重讀 design.md / specs/（升 Opus 輪解除），只讀前輪摘要、Review 報告、要改的檔
    （spec alignment finding 已附 spec 段落原文，orchestrator 全文轉遞）
  → 修復 agent settle 前自跑三件套（靜態關卡跟著每一次修復重新蓋章）

Review PASS with WARNING
  → WARNING 視為需修復，送回對應 agent
  → 同一歸屬的所有 WARNING 合併為一個修復任務（一次改完）
  → 問題歸屬：實作代碼 → Coder，測試代碼 → Tester
  → Coder 和 Tester 的修復任務若同時存在，可平行派發（前提：修復檔案集不相交）
  → 修復後的 re-check 使用 Sonnet model（非完整 Reviewer 流程）
  → re-check agent 載入 `review` skill，執行 targeted check 模式：只讀取改動的檔案和行數，驗證修復是否正確

操作流程驗證 FAIL（觸及 UI/流程時才跑；Reviewer 迴路 settle 後壓軸）
  ├── 流程斷 / console error / spec 明文元件或位置不成立（判 FAIL 前先重現確認一次）
  │     → 回 Coder 修（最多 3 輪）：修復 → 自跑三件套 → review targeted re-check
  │       → 通過後 verify-flow targeted re-run（動態關卡驗的必是最終 code）
  │     → 修復 prompt 附前輪輸出摘要 + 驗證報告（走到哪斷了、哪個元件沒出現、截圖/幾何描述）
  ├── 重現不出（transient）→ 標 flaky，不打回 Coder、不計 retry，寫進報告交人工驗收確認
  └── BLOCKED（無法判定，不計 retry；報告須指明子原因）
        ├── 工具未就緒（Chrome 沒裝/沒連 claude-in-chrome）
        │     → 優雅退化：跳過本關、退回純人工驗收，交付不卡死（非 FAIL、非靜默放行）
        ├── 環境（dev server 起不來 / seed data 不對 / 連不上）
        │     → ⛔ 問人（環境脆弱不該污染 retry 計數）
        └── 登入牆（缺測試帳號 / 第三方 OAuth / SSO / CAPTCHA / 2FA / 魔術連結）
              → ⛔ 問人；優先改用「已驗證入口」（dev session / seeded cookie / auth bypass），
                 別讓 subagent 硬闖登入 UI（脆弱且易觸發 dialog）

Coder / Tester 派發本身失敗或中途中斷
  → 以 git status 對照 tasks.md checkbox 對帳實際完成度後重派（磁碟優先）

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
3. 回報問題 → 依規模路由修正：問題不大到重跑 Tier 3 → 走 `/srun:fix` 場景 (ii)（驗收修正：影響在 spec/design 層先回寫 change artifact，counter 與 model 棘輪歸零重起）；問題動到設計 → 調整 spec/design 後重跑 `/srun:feat`
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
- Tier 2：`fix-<描述>`（如 `fix-nav-mobile`）
- Tier 3：`feat/<change-name>`（如 `feat/add-camera`，與 `feat` Step 2.5 一致）

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

> **狀態：未來可選方向** — 目前不需要實作。現有架構已足夠：知識型 skills 透過 antfu/skills 安裝載入（vue、nuxt、antfu 等），流程型 skills 為專案自有的 srun:feat / srun:fix，SDD 流程由 OpenSpec 管理，專案慣例由 CLAUDE.md 統一管理。當 CLAUDE.md 放不下更多慣例、或各 agent SOP 需要獨立迭代維護時，再考慮拆分。

### 知識型 vs 流程型 vs 行為型分離

| 分類 | 來源 | 範例 | 回答的問題 |
|------|------|------|-----------|
| 知識型 skills | antfu/skills（外部安裝） | vue、nuxt、vitest、antfu、vue-best-practices | 「怎麼寫 Vue/Nuxt」 |
| 流程型 skills | 專案自有 | srun:decisions（動手前決策收斂）、srun:feat（Tier 3 Pipeline）、srun:fix（Tier 2 Pipeline）、srun:review（獨立 Review）、srun:verify-flow（操作流程驗證）、srun:comment（註解整理）、srun:retro（kit 回饋迴路） | 「照什麼步驟跑」 |
| 行為型 skills | 專案自有 | guidelines（Coder 行為守則） | 「寫的當下怎麼自我約束」 |
| SDD 流程指令 | OpenSpec | explore、propose、apply、verify、sync、archive | 「變更怎麼管理」 |

### 原則

- 每個 agent 載入相關的 knowledge skill + 自己的 workflow skill + 適用的 behavioral skill
- 專案慣例統一寫成 knowledge skill，所有 agent 共享
- Knowledge skill 描述「怎麼寫」，workflow skill 描述「照什麼步驟做」，behavioral skill 描述「寫的當下怎麼自我約束」
- 行為型與審查型同源配對：`guidelines`（生成端自律）與 `review`（審查端把關）檢查同一組性質（過度設計、只改必要），一個在 Coder 端預防、一個在 Reviewer 端攔截

---

## ESLint 三層防線

| 層級 | 時機 | 負責者 |
|------|------|--------|
| 第一層 | Coder 完成代碼後 | Coder Agent |
| 第二層 | Git commit 時 | Git pre-commit hook |
| 第三層 | PR / CI 時 | GitHub Actions（依專案） |

### 指令執行慣例（lint / typecheck / test 共用）

所有 agent（Coder / Tester / 註解整理）執行 lint、typecheck 與 test 時，**指令依專案偵測，不寫死裸 `npx`**：

1. 讀 `package.json` 的 `scripts` 與 `packageManager` 欄位（或 root lockfile：`pnpm-lock.yaml` / `yarn.lock` / `package-lock.json`）判定 package manager
2. **優先用專案既有 script**（如 `pnpm lint --fix`、`pnpm test`、`pnpm typecheck`）——尊重專案在 script 裡設定的旗標與設定檔
3. 無對應 script 才 fallback 到本地 binary（`pnpm exec eslint --fix` / `pnpm exec vitest run`，依偵測到的 PM）
4. 避免裸 `npx`：可能觸發下載或用到與專案不符的版本

Tester 需要逐項失敗資訊時，可用 `pnpm exec vitest run --reporter=verbose`（依偵測到的 PM 調整）。

**Typecheck 慣例（G2）**：優先跑專案自己的 `typecheck` script；Nuxt 專案用 `pnpm exec nuxi typecheck`（裸跑 vue-tsc 在未 prepare 的 Nuxt 專案會炸）。掛載點在 **Coder 完成後、與 lint 並列**（回合終點 gate——vue-tsc 全量檢查有 OOM 前科，不適合高頻 hook）；型別錯誤自修、不計 retry（完全比照 ESLint 自修前例）。理由：Tester 排除規則與 Reviewer 不檢查清單都把型別「委派給編譯器」，但 lint 不查型別、vitest 走 esbuild 剝型別、vite/Nuxt dev 刻意不驗型別——此 gate 補上這個空崗位。修復 agent settle 前的自跑組合為「lint + typecheck + test」三件套。
