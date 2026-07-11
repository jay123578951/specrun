---
name: feat
argument-hint: "[change-name]"
description: Tier 3 完整 Pipeline — 實作完整功能、大型重構、架構變更，或需要 spec 記錄的變更（新增 API/元件、行為值得規格化、決策分支多、需拆批；通常 5+ 檔或跨模組，檔案數僅輔助訊號）時使用；前提是已有 OpenSpec change（openspec/changes/<name>/ 含 tasks.md）。派發 Coder→Tester→Reviewer∥操作流程驗證→註解整理。決策已在對話收斂的小改動改用 fix。
---

Tier 3 完整版 Agent Pipeline，適用於需要設計決策的完整功能（新功能、大型重構、架構變更）。透過 OpenSpec 變更 artifact 驅動，派發三個專職 agent 分工執行。

小改動請改用 `/srun:fix`（Tier 2）。

**Input**: 可選指定變更名稱（e.g., `/srun:feat add-auth`）。未指定時從對話推斷或提示選擇。

**依賴**：無外部 plugin 依賴。Reviewer 透過 Task tool 以本 plugin 出貨的 `opus-reviewer` agent 派發（鎖 model 與工具白名單），與主對話 Sonnet 隔離以避免自評自審。

---

## 專案配置

### Agent Knowledge Skills

| Agent | Skills（必載） | 可選 Skills | 用途 |
|-------|---------------|------------|------|
| Coder | `guidelines`, `vue`, `vue-best-practices`, `nuxt`, `antfu` | 由 orchestrator 根據 task 內容預判並寫入 prompt（如 `pinia`, `unocss`, `antfu-design`, `vite`, `vue-router-best-practices`, `vueuse-functions`, `nitro`, `pnpm`, `turborepo`） | `guidelines` 為行為守則（最小可行、外科手術式改動、自主判斷邊界）；其餘為 Vue/Nuxt 開發慣例、程式碼風格、元件拆分守則 |
| Tester | `vitest`, `antfu`, `vue-testing-best-practices` | — | 測試框架用法、Vue 元件測試慣例 |
| Reviewer | `review` | 改動含 `.vue` template / 樣式檔時加 `web-design-guidelines` | Reviewer Opus subagent 使用；同時負責 code quality + 安全性 + 慣例 + spec alignment + 整合輸出 |
| 操作流程驗證 | `verify-flow` | 需 claude-in-chrome 瀏覽器工具 | 觸及 UI/流程時才派發；真點擊走完 spec 流程，驗流程不斷 + spec 明文元件/位置 |

### Model 策略

| Agent | Model | 說明 |
|-------|-------|------|
| Coder | sonnet（預設）/ opus | 預設 sonnet；符合「Coder Model 升級判定」時升 opus（見 Step 3）。升級模式開啟後修復派發一律 opus（見「Retry 迴路」） |
| Tester | sonnet | 修測試的修復派發同樣適用升級模式規則 |
| Reviewer | opus | 經 `opus-reviewer` plugin agent 派發——frontmatter 鎖 model 與工具白名單（無 Write/Edit），報告首行自報實際 model。Code quality + 安全性 + 慣例 + spec alignment 全包；Opus 深度推理 + subagent context 隔離，與主對話 Sonnet 互為獨立視角 |
| Reviewer (WARNING re-check) | sonnet | 小範圍 re-check 不需 Opus，由 Sonnet subagent 跑 `review` 的 targeted check |
| 操作流程驗證 | sonnet | 走瀏覽器流程屬操作性工作，Sonnet 足夠；fresh-context subagent 與主對話隔離避免自評自審 |
| 註解整理 | sonnet | 收尾清理註解，載入 `comment`；機械性偏多不需 Opus，subagent 隔離取得 fresh eyes |

---

## 流程

### Step 1: 選擇變更

1. 若有提供名稱，直接使用
2. 否則從對話推斷，或讀取 `openspec/changes/` 目錄列出進行中的變更讓使用者選擇
3. 宣告：「Using change: <name>」

### Step 2: 確認狀態

確認變更目錄 `openspec/changes/<name>/` 存在，且 `tasks.md` 已產出：

- 變更目錄不存在或缺少 `tasks.md` → 提示先用 OpenSpec 產出 artifact（如 `/opsx:propose`）
- `tasks.md` 必須存在才能繼續

**起跑髒檢查（advisory，不硬擋）**：檢查 working tree——若 `openspec/` **以外**存在與本次變更無關的未 commit 修改，提醒使用者確認後再續跑（無關髒變更會混進 Coder 的 diff 與後續 gate 的檢查範圍）。`openspec/` artifacts 刻意不 commit，排除在判準外。

**`.claude/debug/` lazy cleanup（備援）**：掃 `.claude/debug/` 目錄，凡對應的 `openspec/changes/<name>/` 已不存在者（change 已歸檔或放棄）刪除其殘留檔；change 仍在者不刪——那可能是上次中斷要接手的線索。

### Step 2.5: 建立工作分支

確認當前 git 分支狀態：

- 若在 `main`、`develop` 等主要分支上 → `git checkout -b feat/{changeName}`
- 若已在功能分支上 → 跳過

### Step 3: 評估任務規模與分批策略

讀取 tasks.md，以 **Task 大項（T1、T2、T3…）** 為單位評估：

- **單一大項**：整批派發給一個 Coder Agent
- **多個大項**：每個大項為一批，獨立走 Coder → Tester 流程，全部完成後再跑一次完整 Reviewer
- **大項之間有依賴關係時**（如 T2 使用 T1 產出的模組），按依賴順序串行執行
- **大項之間無依賴時**，可平行派發

依賴判斷優先從 task 描述推斷。**若無法明確判斷，預設為串行執行（保守策略）。** 只有在 orchestrator 確信無依賴時才平行派發。

Task 大項本身對應 spec 的模組邊界，天然適合作為分批單位。不以 checkbox 數量切分，避免把同一模組的邏輯拆散到不同 agent。

**跨批 Context 注意事項**

串行執行時，後續批次的 Coder prompt 須額外包含：
- 前批產出的檔案清單
- 前批 Coder 的關鍵設計決策摘要（來自 Step 4 的輸出）

目的：確保後批 agent 沿用前批建立的介面與慣例，而非僅靠讀取原始碼推斷。

Retry 修復時，若修改涉及跨批共用的介面（如 composable 的回傳結構），orchestrator 應重跑受影響批次的測試。

**Coder Skills 預判**

Orchestrator 依 `${CLAUDE_SKILL_DIR}/references/coder-skills-map.md` 的預判表，根據 tasks.md 內容判斷必載 skills 之外的額外 skills，寫入 `{additionalSkills}` 變數。

**Coder Model 升級判定**

Step 4 **首次**派發 Coder 前，下列任一條件成立則設 `{coderModel}` 為 `opus`，否則為 `sonnet`：

- **架構變更 / 大型重構**：改動跨多個模組邊界，或修改既有公開 interface（composable 回傳結構、store API、共用型別）
- **安全敏感路徑**：改動觸及 auth、payment、API key 處理、session 管理（與 Step 6 adversarial 判定共用條件）
- **設計決策密集**：design.md 將較多實作方式留給 Coder 自行決定，而非 spec 已寫死

判定保守：只在「先驗上即可預期需要深度推理」時升 opus，一般功能（spec 已明確、單模組、無安全顧慮）維持 sonnet。

Retry 中的動態升級規則見「Retry 迴路」的升級模式。

### Step 4: 派發 Coder Agent

派發前把 `${CLAUDE_SKILL_DIR}/references/command-conventions.md` 的**絕對路徑**代入 `{commandConventionsPath}`。使用 Task tool 派發 subagent（model: {coderModel}）：

```
你是 Coder Agent。

變更名稱：{changeName}
變更目錄：openspec/changes/{changeName}/
實作範圍：{taskList}（若為分批模式，僅列本批 task）

開始工作前：
1. 用 Skill tool 載入以下 skills：srun:guidelines, vue, vue-best-practices, nuxt, antfu{additionalSkills}
   （`guidelines` 是寫 code 的行為守則，其餘為知識型；務必先讀 `guidelines` 再動手）
   任一必載 skill 載入失敗（缺裝／改名）→ 停下回報，不要在缺慣例約束的情況下繼續寫
2. 讀取專案的 CLAUDE.md 了解專案慣例
3. 讀取變更目錄下的 design.md、tasks.md 和 specs/ 下的 delta spec 檔案

注意：若實作過程中發現需要用到上方未列出的 skill，可自行載入補充。

依照指定的 task 逐項實作：
- 遵循專案設計系統與慣例
- 善用既有的 composables 和 utils
- 每完成一個 task，更新 tasks.md 的 checkbox：`- [ ]` → `- [x]`
- 允許順手撰寫自證用的測試（不強制）；正式的測試設計與稽核由 Tester 負責

完成後依序執行 lint 與 typecheck（指令選用一律依 {commandConventionsPath}；錯誤自行修復，不計 retry）

輸出：
1. 列出你建立/修改/刪除的所有檔案路徑
2. 簡述每個 task 的關鍵設計決策（供 retry 時參考）
3. 若有順手寫測試，列出測試檔路徑（供 Tester 稽核）
```

### Step 5: 派發 Tester Agent

使用 Task tool 派發 subagent（model: sonnet）。派發前把 `${CLAUDE_SKILL_DIR}/references/tester-conventions.md` 的**絕對路徑**代入 `{testerConventionsPath}`：

```
你是 Tester Agent，角色是**獨立稽核者**——你的價值不是「跑一遍看綠紅」，而是從 spec 獨立推導應驗證的行為，抓出「Coder 的誤解同時寫進 code 和測試然後全綠」這類假信心。

變更名稱：{changeName}
變更目錄：openspec/changes/{changeName}/

Coder 產出的檔案：
{coderOutputFiles}

Coder 順手寫的測試檔（第 ② 步之前禁止查看）：
{coderTestFiles，無則寫「無」}

開始工作前：
1. 用 Skill tool 載入以下 skills：vitest, antfu, vue-testing-best-practices
   任一必載 skill 載入失敗（缺裝／改名）→ 停下回報，不要在缺慣例約束的情況下繼續寫
2. Read 測試撰寫守則：{testerConventionsPath}（撰寫規範、排除規則、Nuxt composable 三層策略、執行指令、輸出必含皆在其中；讀不到 → 停下回報）
3. 讀取變更目錄下的 specs/ 目錄（了解預期行為的 scenarios）
4. 讀取變更目錄下的 design.md（了解設計意圖，使測試貼近實作決策而非僅驗表面行為）
5. 讀取上方列出的 Coder 產出/修改檔案

工作順序（防錨定的關鍵，依序執行）：
① 先讀 specs/ 的 scenarios，**獨立列出應驗證行為清單**——此階段**禁止查看任何測試檔**（含 Coder 順手寫的），避免被既有斷言錨定
② 對照既有測試（含 Coder 本輪所寫）找缺口與錯誤斷言
③ 補寫缺少的測試、修正錯誤的斷言——針對 spec 中的每個 scenario 撰寫，撰寫與執行依守則檔
④ 依守則檔的執行節奏跑測試（scoped 收斂、收尾全量蓋章）並輸出報告

輸出：
1. 應驗證行為清單（①的產出）
2. 守則檔「輸出必含」列出的各項
```

**測試失敗時**：進入 Retry 迴路（見下方）。

### Step 6: Reviewer（Opus subagent）

**Reviewer Skills 預判**

Orchestrator 根據 Coder 修改的檔案清單判斷 Reviewer 除了必載的 `review` 外，是否需要追加 skill，寫入 `{reviewerAdditionalSkills}` 變數：

- 改動觸及 `.vue` 檔的 `<template>` 或 `<style>` 區塊（純 `<script>` 邏輯改動不算），或改動純 `.css` / `.scss` / `.sass` / `.less` 檔 → 加 `web-design-guidelines`（覆蓋 UI/UX/a11y 檢查）
- 改動以 UnoCSS 建構 UI（`.vue` template/style 用到 UnoCSS utility／shortcut，或改 `uno.config`）→ 加 `antfu-design`（審查 semantic token 使用、雙 light/dark 主題、不用 attributify 等設計慣例遵循；與 `web-design-guidelines` 互補，後者管 a11y／UX，前者管 UnoCSS 設計慣例）
- 改動觸及 Nuxt/Nitro server 端（`server/` API routes／event handlers、`nitro.config`、`routeRules`、server 快取／tasks）→ 加 `nitro`（審查 route rules、快取策略、event handler 慣例）

**Adversarial 模式判斷**

Step 6 **首次**派發 Reviewer 前，下列任一條件成立則設 `{adversarial}` 為 `true`，否則為 `false`：

- 改動觸及安全敏感路徑（auth、payment、API key 處理、session 管理）
- 改動含資料庫 schema 變更或生產資料遷移

Retry 後續輪次的 adversarial 升級由「Retry 迴路」的升級模式管理，不在此處重複判斷。

> 註：`review` skill 另列了「使用者明確要求深度 review」這條 adversarial 觸發條件，但 `/srun:feat` 流程不接收 ad-hoc adversarial 指令。如需在 Pipeline 完成後對特定 diff 跑深度 review，請另外執行 `/srun:review`。

使用 Task tool 派發 subagent，派發參數固定為 **`subagent_type: opus-reviewer`**（本 plugin 出貨的 agent：frontmatter 鎖 `model: opus` 與工具白名單——有 Bash 供自跑 `git diff`、無 Write/Edit 的 report-only 門檻；報告第一行自報實際 model 作 runtime 降級偵測）。

prompt 由 orchestrator 依 `srun:review` 的「Reviewer Subagent Prompt 模板」展開（展開規則與 context budget 守則皆見該 skill）——展開後的 prompt 已內含完整 review 標準與輸出格式，subagent 不需另行載入 `srun:review`：

- Scope 代入 `change:{changeName}` 模式；`{adversarial}` 依上方判定代入
- `{reviewerAdditionalSkills}` 依上方預判代入（如 `web-design-guidelines`），由模板的追加 skills 條件區塊指示 subagent 載入
- 「{若 feat 載入：}」條件區塊成立：prompt 末段附上 Coder 產出摘要（檔案清單＋設計決策）與 Tester 產出摘要（測試檔案＋測試結果）

Subagent 直接輸出最終格式的 review 報告，orchestrator 不再做後續包裝或補檢；只負責呈現給使用者並依判定進入 retry 迴路或下一步。

**Subagent 派發失敗時**：記錄錯誤並停下來問人。不要退化為主對話 Sonnet 自做 review（會破壞「獨立審查」的設計初衷）。

**Review 不通過時**：進入 Retry 迴路（見下方）。

### Step 6.5: 操作流程驗證（Sonnet subagent，觸及 UI/流程時才跑）

**觸發判斷**（本步驟自己的信號，與 Step 6 的 `web-design-guidelines` 偵測信號不同——後者含純樣式改動，本步驟不含）：

- **派發**：改動含 `.vue` 的 `<template>`，或有頁面 / 路由 / 互動流程變更
- **派發（OR 條件——無法測試清單的消費者）**：Tester 的「無法測試的模組清單」非空、且模組被頁面使用（orchestrator grep composable 名稱於 pages/components，一條指令）→ 即使按上述檔案類型本會跳過（如純 composable 改動）也**強制派發**，並把 grep 命中的受影響頁面清單注入 prompt 做 targeted 驗證——讓 Tester 的警訊有人接
- **跳過**：純後端 / 純邏輯改動（且不觸發上述 OR 條件）→ 直接進 Step 6.7 註解整理
- **跳過**：**純樣式 changeset**（只動 `<style>` 區塊或純樣式檔）→ 不觸發本步驟——樣式改動驗不出「流程斷裂」這類信號，UI/UX 面向交給 Step 6 Reviewer 的 `web-design-guidelines` 把關

**與 Reviewer 的關係（序列，不平行）**：統一原則——**靜態關卡（測試＋review）跟著每一次修復重新蓋章；動態關卡（本步驟）永遠壓軸，驗的必是最終 code**。Step 6 Reviewer 迴路**完全 settle**（含 targeted re-check 通過）後才派發本步驟，故本步驟的 PASS 不會過期。本步驟 FAIL 的修復走完整靜態關卡後才 targeted re-run（見 Retry 迴路）。

**前置**：orchestrator 確保 dev server 正在跑（或在 prompt 告知啟動方式）；功能在登入牆後時，提供「已驗證入口」（dev session / seeded cookie / auth bypass），或（登入本身是被測流程時）測試帳號。

使用 Task tool 派發 subagent，固定 **`subagent_type: general-purpose` + `model: sonnet`**。載入 `srun:verify-flow` skill，由其 subagent prompt 模板驅動；orchestrator 注入：變更名稱、app URL / 啟動方式、驗收依據（`openspec/changes/{changeName}/specs/`）、已知的重點元件 / 位置、必要時的已驗證入口或測試帳密。判準、輸出格式、preflight、登入牆與反 rabbit-hole 規則皆見 `verify-flow` skill，此處不重複。

**verdict 分支**：

- **PASS** → 進 Step 6.7（Reviewer 已於本步驟前 settle）
- **FAIL**（流程斷 / console error / spec 明文元件或位置不成立；判 FAIL 前 agent 已依 `verify-flow` 做過重現確認）→ 進 Retry 迴路回 Coder 修（見下方）
- **flaky 標註**（一次性錯誤、重現不出）→ 不打回 Coder、不計 retry；orchestrator 把標註原樣帶進 Step 7 報告，交人工驗收確認
- **BLOCKED**（不計 retry，報告須註明子原因）：
  - **工具未就緒**（Chrome 沒裝 / 沒連 claude-in-chrome）→ **跳過本步、退回純人工驗收**，報告註明「未能自動驗證，請人工走一遍」。**不當 FAIL**（別打回 Coder）、**不靜默放行**，不阻斷交付
  - **環境**（dev server / seed data / 連不上）或 **登入牆**（缺測試帳號 / 第三方 OAuth / SSO / CAPTCHA / 2FA / 魔術連結）→ 停下來問人

**Subagent 派發失敗時**：判為 BLOCKED（工具未就緒）處理——跳過本步、退回人工驗收，不退化為主對話自做。

### Step 6.7: 註解整理（Sonnet subagent）

Reviewer 判定 PASS（含 WARNING re-check 完成）、且操作流程驗證 gate 已綠（PASS 或因工具未就緒而跳過）後、報告結果前，派發一次註解整理 Agent，清除本次 Pipeline 累積的過時／疊加／思考流程註解。

- 載入 `srun:comment` skill 取得整理規範與輸出格式
- 使用 Task tool 派發 subagent，固定 **`subagent_type: general-purpose` + `model: sonnet`**
- scope 為「本次 Pipeline 修改的檔案清單」（即 Coder 各批產出 + Tester 測試檔），由 orchestrator 注入 prompt 的 `{changedFiles}`，subagent 不需自行偵測 diff
- 整理 Agent 依守則**直接套用 Edit**並自跑 lint --fix（指令選用由 `comment` 規範，見其引用的 command-conventions；不可刪除功能型指令註解，如 `eslint-disable`、`@ts-expect-error`、`istanbul ignore`、`v-html` 安全註記）
- 整理完成後，**orchestrator 重跑一次測試**（專案 test script，如 `pnpm test`）作為安全網——純註解改動不該破壞行為，失敗多半是誤刪到功能型註解，回整理 Agent 修正（最多 1 輪），仍失敗 → 停下來問人。注意此安全網接不住 build-time pragma（`@__PURE__`、`webpackChunkName` 等）的誤刪——測試驗不到，靠 `comment` 保護清單防守

整理後**不需**重跑 Opus Reviewer 或操作流程驗證（純註解改動不動 code 邏輯）；ESLint + 測試即為安全網。

### Step 7: 報告結果

顯示 Phase 2 完成摘要（含操作流程驗證報告中的 flaky 標註與待人確認項），提示進入 Phase 3 人工驗收。

**retro 記錄（一行呼叫）**：載入 `srun:retro` skill，依其記錄模式把本次 run 的事件與統計 append 進全域收件匣（事件表與條目格式以該 skill 為單一來源，此處不複製）；收件匣 > 30 筆時在完成報告加一行提醒 `/srun:retro --archive`。append 失敗不阻斷報告，註記即可。

報告輸出後，**主動刪除**本次 change 在 `.claude/debug/` 的殘留檔（驗證截圖、除錯檔）——檔案價值僅在執行中；`.claude/` 應由專案 gitignore 蓋掉，不進版控。

---

## Retry 迴路

### 通用規格（所有 gate 共用）

- **一輪的定義**：「gate 失敗回到主對話 → 派 agent 修 → 重驗」＝該 gate 一輪。各 gate 獨立計數、**各自最多 3 輪**，輪數在同一 Pipeline 內累計不因修復成功重置；達上限 → 停下來問人（問題可能較嚴重或 AI 忽略關鍵細節）
- **不計輪**：agent 就地自修（lint／typecheck／三件套紅燈，未回主對話）、BLOCKED（回主對話是為了問人）、flaky 標註（回主對話是為了告知）、targeted re-check／re-run（驗證派發，非問題回報）
- **修復派發 prompt 一律附**：失敗報告（依 gate：失敗測試名稱＋錯誤訊息／Review 報告／驗證報告含截圖或幾何描述）、**前一輪輸出摘要**（檔案清單＋設計決策，避免 context 斷裂）、明確修復指示。spec alignment 類 finding 已依 `review` 規範附上被違反的 spec 段落原文——orchestrator **全文轉遞**，修復 agent 不必重讀 spec 檔
- **免重讀**：修復 agent 不需重讀 design.md／specs/，只讀前輪摘要、失敗報告、要修改的檔案。**升級模式開啟後解除此限制**——解禁不是強制，是否重讀、讀哪份（design.md 與 specs/）由 Opus 自行判斷
- **修復 agent settle 前自跑三件套**（lint + typecheck + 專案 test script）：紅燈就地修不計輪；就地修不掉、或判斷失敗屬測試問題 → 回報主對話（計下一輪，或走 test-defect 申辯）
- **升級模式（全 Pipeline 單一開關，開啟後不關閉）**：任一 gate 進入第 2 輪修復即開啟——此後**所有修復派發升 Opus**（不論被派的是 Coder 或 Tester）、**Opus Reviewer 重派一律帶 `{adversarial}=true`**、免重讀限制解除。targeted re-check／re-run 是驗證派發，維持 Sonnet 不受影響；Reviewer 自身固定 Opus，無升級問題

### 各 gate 差異

| Gate 失敗 | 誰修 | 修完重驗什麼 |
|----------|------|-------------|
| 測試 | Coder（判斷屬測試問題 → 走申辯通道） | 三件套全綠即 settle，**不重派 Tester**——修復後防的是機械回歸，跑套件即可；Tester 的獨立價值在首輪設計測試 |
| Review FAIL（有 CRITICAL） | 依歸屬：實作代碼 → Coder、測試代碼 → Tester；嚴重安全問題 → 直接停下來問人（認為 finding 不成立 → 走 review-finding 申辯通道） | 重派 Opus Reviewer |
| Review PASS with WARNING | WARNING 視為需修復；依歸屬修，**同一歸屬的所有 WARNING 合併為一個修復任務一次改完**（認為 finding 不成立 → 走 review-finding 申辯通道） | Sonnet targeted re-check（執行 `review` 的 Targeted Check 模式：只審修復 diff、驗證修復正確且未引入新問題；**不升級為 Opus 完整 review**） |
| 操作流程驗證 FAIL | Coder（判 FAIL 前 agent 已依 `verify-flow` 做過重現確認） | 完整靜態關卡再壓軸重驗：三件套 → Sonnet targeted re-check（只審修復 diff）→ **verify-flow targeted re-run**（只重走受影響流程） |

操作流程驗證的 BLOCKED（工具未就緒 → 跳過退回人工驗收；環境／登入牆 → 問人）與 flaky 標註不進迴路、不計輪（見 Step 6.5）。

### test-defect 申辯通道

Coder 判斷測試失敗原因是「測試與驗收依據不符」時（不論該測試的原作者是誰），可回報 test-defect：**必須引用驗收依據原文**（spec scenario／design 段落，含來源路徑）並指出斷言不符之處，**引不出原文不受理**，乖乖修 code。受理後主對話**改派 Tester 修測試**——測試檔一律只有 Tester 能動；Tester 可反駁，同樣須引依據原文。申辯輪照計輪。

### review-finding 申辯通道

修復 agent（Coder 或 Tester）判斷被指派修復的 review finding 不成立時（Reviewer 誤讀程式碼、finding 與驗收依據或專案慣例衝突、建議修法會違反 spec），可回報 review-defect：**必須引用依據原文**（spec 段落／CLAUDE.md 條文，含來源路徑；或指出誤讀處的檔案:行號與實際行為），**引不出依據不受理**，乖乖修。CRITICAL 與 WARNING 的修復派發皆適用。

受理後主對話重派 **Opus Reviewer 仲裁**——targeted 派發：只裁被申辯的 finding，prompt 附原 finding 與申辯全文，要求逐點回應申辯依據後判「維持／撤回」；不重做完整 review、不計 Reviewer retry counter（性質同 targeted re-check 的驗證派發）。

- **撤回** → 該 finding 自修復清單移除；該輪所有待修項皆被撤回 → 該輪視為通過，不需 re-check
- **維持**而修復 agent 仍有異議 → 停下來問人（人是最終仲裁）

申辯輪照計輪——防止以連續申辯拖延修復。

---

## 輸出格式

### Phase 2 完成

```
## Phase 2 完成：{changeName}

### Agent Pipeline 結果
- Coder: ✓ 完成（N 個檔案）
- Tester: ✓ 通過（M 個測試）
- Reviewer: ✓ PASS
- 操作流程驗證: ✓ PASS（或「跳過（未觸及 UI）」/「跳過（claude-in-chrome 未就緒，請人工驗證）」）
- 註解整理: ✓ 清除 X 處 / 改寫 Y 處（測試重跑通過）

### Pipeline 統計
- 分批：{batchCount} 批（或「單批」）
- Coder 派發次數：{coderCalls}（含 retry）
- Tester 派發次數：{testerCalls}（含 retry）
- Reviewer 派發次數：{reviewerCalls}（含 retry）

### Retry 記錄
（若有 retry，列出每輪的問題與修復摘要）

### 下一步
進入 Phase 3 人工驗收。請啟動 dev server 測試功能。
驗收通過後，執行：
1. /opsx:verify
2. /opsx:sync
3. /opsx:archive
```

### 遇到阻塞

依 `${CLAUDE_SKILL_DIR}/references/blocked-report.md` 的模板：先輸出 debug 檔 `.claude/debug/{changeName}-{timestamp}.md`（生命週期見 Step 2 lazy cleanup 與 Step 7 主動刪），再向使用者顯示阻塞摘要。

---

## Guardrails

- 每個 agent 的 prompt 只傳變更名稱和目錄，讓 agent 自行讀取 artifacts；不在 prompt 中貼入檔案內容
- Coder（含 retry 派發）一律先載入 `guidelines` 行為守則再動手——從生成端約束過度設計與越界改動
- Coder 的輸出（檔案清單 + 設計決策）由 orchestrator 保留，用於傳遞給後續 agent 和 retry
- 獨立的修復任務可平行派發，**前提是修復檔案集不相交**（如 Coder 與 Tester 各修不同檔案的 WARNING）；檔案相交或無法確定 → 串行
- Coder / Tester 派發本身失敗或中途中斷 → 以 `git status` 對照 tasks.md checkbox **對帳實際完成度**後再重派（磁碟優先，不憑對話記憶推測進度）
- 各 gate 3 輪上限後必須停下來問人，不可繼續嘗試
- Pipeline 開始前確保在功能分支上，不直接在主要分支開發
- 操作流程驗證是人工驗收的前置過濾器，不取代人工驗收
- Pipeline 完成後不自動 commit，等人工驗收通過後再走交付流程
