---
name: code-feat
description: Tier 3 完整 Pipeline — 實作完整功能、大型重構、架構變更，或需要 spec 記錄的變更（新增 API/元件、行為值得規格化、決策分支多、需拆批；通常 5+ 檔或跨模組，檔案數僅輔助訊號）時使用；前提是已有 OpenSpec change（openspec/changes/<name>/ 含 tasks.md）。派發 Coder→Tester→Reviewer∥操作流程驗證→註解整理。決策已在對話收斂的小改動改用 code-fix。
---

Tier 3 完整版 Agent Pipeline，適用於需要設計決策的完整功能（新功能、大型重構、架構變更）。透過 OpenSpec 變更 artifact 驅動，派發三個專職 agent 分工執行。

小改動請改用 `/code:fix`（Tier 2）。

**Input**: 可選指定變更名稱（e.g., `/code:feat add-auth`）。未指定時從對話推斷或提示選擇。

**依賴**：無外部 plugin 依賴。Reviewer 透過 Task tool 以本 plugin 出貨的 `opus-reviewer` agent 派發（鎖 model 與工具白名單），與主對話 Sonnet 隔離以避免自評自審。

---

## 專案配置

### Agent Knowledge Skills

| Agent | Skills（必載） | 可選 Skills | 用途 |
|-------|---------------|------------|------|
| Coder | `code-guidelines`, `vue`, `vue-best-practices`, `nuxt`, `antfu` | 由 orchestrator 根據 task 內容預判並寫入 prompt（如 `pinia`, `unocss`, `vite`, `vue-router-best-practices`, `vueuse-functions`, `pnpm`, `turborepo`） | `code-guidelines` 為行為守則（最小可行、外科手術式改動、自主判斷邊界）；其餘為 Vue/Nuxt 開發慣例、程式碼風格、元件拆分守則 |
| Tester | `vitest`, `antfu`, `vue-testing-best-practices` | — | 測試框架用法、Vue 元件測試慣例 |
| Reviewer | `code-review` | 改動含 `.vue` template / 樣式檔時加 `web-design-guidelines` | Reviewer Opus subagent 使用；同時負責 code quality + 安全性 + 慣例 + spec alignment + 整合輸出 |
| 操作流程驗證 | `code-verify-flow` | 需 claude-in-chrome 瀏覽器工具 | 觸及 UI/流程時才派發；真點擊走完 spec 流程，驗流程不斷 + spec 明文元件/位置 |

### Model 策略

| Agent | Model | 說明 |
|-------|-------|------|
| Coder | sonnet（預設）/ opus | 預設 sonnet；符合「Coder Model 升級判定」時升 opus（見 Step 3）。Retry 迴路中任一迴路 counter ≥ 2 起，該迴路的修復派發強制升 opus（統一規則，見「修復派發 Model 升級」） |
| Tester | sonnet | 修測試的修復派發同樣適用「counter ≥ 2 起升 opus」統一規則 |
| Reviewer | opus | 經 `opus-reviewer` plugin agent 派發——frontmatter 鎖 model 與工具白名單（無 Write/Edit），報告首行自報實際 model。Code quality + 安全性 + 慣例 + spec alignment 全包；Opus 深度推理 + subagent context 隔離，與主對話 Sonnet 互為獨立視角 |
| Reviewer (WARNING re-check) | sonnet | 小範圍 re-check 不需 Opus，由 Sonnet subagent 跑 `code-review` 的 targeted check |
| 操作流程驗證 | sonnet | 走瀏覽器流程屬操作性工作，Sonnet 足夠；fresh-context subagent 與主對話隔離避免自評自審 |
| 註解整理 | sonnet | 收尾清理註解，載入 `code-comment`；機械性偏多不需 Opus，subagent 隔離取得 fresh eyes |

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

Orchestrator 根據 tasks.md 內容判斷 Coder 除了必載的 `vue`, `vue-best-practices`, `nuxt`, `antfu` 外，還需要哪些額外 skills，寫入 `{additionalSkills}` 變數。例如：
- task 涉及 store / state → 加 `pinia`
- task 涉及 CSS utility / atomic → 加 `unocss`
- task 涉及 build config / plugin → 加 `vite`
- task 涉及路由 / middleware / navigation guard / route params → 加 `vue-router-best-practices`
- task 涉及 DOM 事件 / 瀏覽器 API / 常見 composable 場景（local storage、media query、resize、clipboard 等）→ 加 `vueuse-functions`
- 專案使用 pnpm（`package.json` 含 `"packageManager": "pnpm@..."` 或根目錄存在 `pnpm-lock.yaml`）且 task 涉及依賴 / workspace / catalog / patch → 加 `pnpm`
- 專案為 monorepo（根目錄 `Glob turbo.json` 命中）且 task 跨 package → 加 `turborepo`

**Coder Model 升級判定**

Step 4 **首次**派發 Coder 前，下列任一條件成立則設 `{coderModel}` 為 `opus`，否則為 `sonnet`：

- **架構變更 / 大型重構**：改動跨多個模組邊界，或修改既有公開 interface（composable 回傳結構、store API、共用型別）
- **安全敏感路徑**：改動觸及 auth、payment、API key 處理、session 管理（與 Step 6 adversarial 判定共用條件）
- **設計決策密集**：design.md 將較多實作方式留給 Coder 自行決定，而非 spec 已寫死

判定保守：只在「先驗上即可預期需要深度推理」時升 opus。一般功能（spec 已明確、單模組、無安全顧慮）維持 sonnet——Pipeline 的 Tester + Opus Reviewer + retry 已能接住表層瑕疵。

Retry 迴路中的動態升級規則見「Retry 迴路 → 修復派發 Model 升級（統一規則）」段。

### Step 4: 派發 Coder Agent

使用 Task tool 派發 subagent（model: {coderModel}）：

```
你是 Coder Agent。

變更名稱：{changeName}
變更目錄：openspec/changes/{changeName}/
實作範圍：{taskList}（若為分批模式，僅列本批 task）

開始工作前：
1. 用 Skill tool 載入以下 skills：code-guidelines, vue, vue-best-practices, nuxt, antfu{additionalSkills}
   （`code-guidelines` 是寫 code 的行為守則，其餘為知識型；務必先讀 `code-guidelines` 再動手）
   任一必載 skill 載入失敗（缺裝／改名）→ 停下回報，不要在缺慣例約束的情況下繼續寫
2. 讀取專案的 CLAUDE.md 了解專案慣例
3. 讀取變更目錄下的 design.md、tasks.md 和 specs/ 下的 delta spec 檔案

注意：若實作過程中發現需要用到上方未列出的 skill，可自行載入補充。

依照指定的 task 逐項實作：
- 遵循專案設計系統與慣例
- 善用既有的 composables 和 utils
- 每完成一個 task，更新 tasks.md 的 checkbox：`- [ ]` → `- [x]`
- 允許順手撰寫自證用的測試（不強制）；正式的測試設計與稽核由 Tester 負責

完成後依序執行（錯誤自行修復，不計 retry）：
1. 專案 lint script（優先用專案既有 script，如 `pnpm lint --fix`；無對應 script 才 fallback 到 `pnpm exec eslint --fix`。依專案 package manager 調整指令，不要用裸 `npx`）
2. typecheck：優先跑專案自己的 `typecheck` script；Nuxt 專案用 `pnpm exec nuxi typecheck`（裸跑 vue-tsc 在未 prepare 的 Nuxt 專案會炸）

輸出：
1. 列出你建立/修改/刪除的所有檔案路徑
2. 簡述每個 task 的關鍵設計決策（供 retry 時參考）
3. 若有順手寫測試，列出測試檔路徑（供 Tester 稽核）
```

### Step 5: 派發 Tester Agent

使用 Task tool 派發 subagent（model: sonnet）：

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
2. 讀取變更目錄下的 specs/ 目錄（了解預期行為的 scenarios）
3. 讀取變更目錄下的 design.md（了解設計意圖，使測試貼近實作決策而非僅驗表面行為）
4. 讀取上方列出的 Coder 產出/修改檔案

工作順序（防錨定的關鍵，依序執行）：
① 先讀 specs/ 的 scenarios，**獨立列出應驗證行為清單**——此階段**禁止查看任何測試檔**（含 Coder 順手寫的），避免被既有斷言錨定
② 對照既有測試（含 Coder 本輪所寫）找缺口與錯誤斷言
③ 補寫缺少的測試、修正錯誤的斷言
④ 跑全套測試並輸出報告

撰寫測試：
- 測試檔放在與源碼同目錄（foo.test.ts）
- 使用 describe/it API 結構
- 針對 spec 中的每個 scenario 撰寫測試
- 純邏輯函式應抽出為獨立模組，測試 import 實際模組（不複製邏輯）

排除規則（不要撰寫以下測試）：
- TypeScript 型別/介面欄位存在性測試（typecheck gate 已保證型別正確性）

Nuxt composable 的測試策略（三層，依序）：
1. 純邏輯抽為獨立模組的規則不變（結構層優先）——能測 import 實際模組的先這樣測
2. 殘餘的 Nuxt runtime 依賴：讀 package.json 偵測 `@nuxt/test-utils` 是否已裝——已裝即用它直接測；只在需要重環境的測試檔標 `@vitest-environment nuxt`，純邏輯測試照走輕環境。永不主動安裝依賴
3. 未裝才跳過該模組的單元測試（不要複製邏輯自測），列入「無法測試的模組清單」輸出

完成後執行測試：優先跑專案 test script（如 `pnpm test`，依專案 package manager 調整）；需要逐項失敗資訊時用 `pnpm exec vitest run --reporter=verbose`。不要用裸 `npx`。

輸出：
1. 應驗證行為清單（①的產出）與對應的測試檔案路徑（含補寫/修正了什麼）
2. 測試結果（通過/失敗）
3. 若有失敗，列出每個失敗的測試名稱和錯誤原因
4. 無法測試的模組清單（列出模組名稱與跳過原因，如「useXxxApi — Nuxt composable，無法在單元測試中 import」）
```

**測試失敗時**：進入 Retry 迴路（見下方）。

### Step 6: Reviewer（Opus subagent）

**Reviewer Skills 預判**

Orchestrator 根據 Coder 修改的檔案清單判斷 Reviewer 除了必載的 `code-review` 外，是否需要追加 skill，寫入 `{reviewerAdditionalSkills}` 變數：

- 改動觸及 `.vue` 檔的 `<template>` 或 `<style>` 區塊（純 `<script>` 邏輯改動不算），或改動純 `.css` / `.scss` / `.sass` / `.less` 檔 → 加 `web-design-guidelines`（覆蓋 UI/UX/a11y 檢查）

**Adversarial 模式判斷**

Step 6 **首次**派發 Reviewer 前，下列任一條件成立則設 `{adversarial}` 為 `true`，否則為 `false`：

- 改動觸及安全敏感路徑（auth、payment、API key 處理、session 管理）
- 改動含資料庫 schema 變更或生產資料遷移

Retry 後續輪次的 adversarial 升級規則由「Retry 迴路 → Review FAIL」段管理（見下方 Reviewer 輪次追蹤），不在此處重複判斷。

> 註：`code-review` skill 另列了「使用者明確要求深度 review」這條 adversarial 觸發條件，但 `/code:feat` 流程不接收 ad-hoc adversarial 指令。如需在 Pipeline 完成後對特定 diff 跑深度 review，請另外執行 `/code:review`。

使用 Task tool 派發 subagent，派發參數固定為 **`subagent_type: opus-reviewer`**（本 plugin 出貨的 agent：frontmatter 鎖 `model: opus` 與工具白名單——有 Bash 供自跑 `git diff`、無 Write/Edit 的 report-only 門檻；報告第一行自報實際 model 作 runtime 降級偵測）。prompt 展開規則（`{變數}` 替換、`{若...：}` 條件區塊處理）與 context budget 守則皆見 `code-review` skill：

```
你是 Code Reviewer Agent，使用 Opus 深度推理執行獨立 code review。

模式：{standard | adversarial}
Scope：change:{changeName}
變更名稱：{changeName}
變更目錄：openspec/changes/{changeName}/

--- Coder 產出摘要 ---
修改的檔案：
{coderOutputFiles}

設計決策：
{coderDesignDecisions}

--- Tester 產出摘要 ---
測試檔案：
{testerOutputFiles}

測試結果：
{testerResults}

---

開始工作前：

1. 用 Skill tool 載入以下 skills：code-review{reviewerAdditionalSkills}
   `code-review` 是你的 review 標準、prompt 結構與輸出格式的單一來源；若有追加 skill（如 `web-design-guidelines`），用於補強對應領域的審查面向
2. 讀取變更目錄下的所有 artifacts（proposal.md、design.md、tasks.md、specs/）
3. 讀取上方列出的 Coder 產出檔案：
   - 預設：讀取完整內容（不只看 diff）
   - 若本 prompt 已標註某些檔案「僅讀 diff」（context budget fallback），依標註執行
   - 執行中若仍發現 context 不足，於報告開頭以 `open question` 標記受影響的檔案
4. 讀取專案的 CLAUDE.md 了解專案慣例（特別注意：CLAUDE.md 定義的 UI 語言慣例、CSS 變數使用、設計系統慣例）

工作範圍：

- 程式碼品質（命名、結構、可讀性、重複邏輯、過度抽象）
- 安全性（API key、XSS、注入、敏感資料、若為 adversarial 模式額外做 red team 視角分析）
- 專案慣例（CLAUDE.md 定義的 UI 語言慣例、CSS 變數、設計系統等規則）
- 測試品質（若有測試檔變更）
- Spec 一致性（對照 OpenSpec 變更 artifact 驗證 requirements / scenarios / design 決策）

完成後依 `code-review` skill 定義的輸出格式產出最終 review 報告（含 Spec Alignment 檢核表 + 問題清單 + SUGGESTION + 摘要 + PASS/FAIL/WARNING 判定）。
```

Subagent 直接輸出最終格式的 review 報告，orchestrator 不再做後續包裝或補檢；只負責呈現給使用者並依判定進入 retry 迴路或下一步。

**Subagent 派發失敗時**：記錄錯誤並停下來問人。不要退化為主對話 Sonnet 自做 review（會破壞「獨立審查」的設計初衷）。

**Review 不通過時**：進入 Retry 迴路（見下方），adversarial 升級規則由 Retry 迴路統一管理（見「Review FAIL → Reviewer 輪次追蹤」）。

### Step 6.5: 操作流程驗證（Sonnet subagent，觸及 UI/流程時才跑）

**觸發判斷**（本步驟自己的信號，與 Step 6 的 `web-design-guidelines` 偵測信號不同——後者含純樣式改動，本步驟不含）：

- **派發**：改動含 `.vue` 的 `<template>`，或有頁面 / 路由 / 互動流程變更
- **派發（OR 條件——無法測試清單的消費者）**：Tester 的「無法測試的模組清單」非空、且模組被頁面使用（orchestrator grep composable 名稱於 pages/components，一條指令）→ 即使按上述檔案類型本會跳過（如純 composable 改動）也**強制派發**，並把 grep 命中的受影響頁面清單注入 prompt 做 targeted 驗證——讓 Tester 的警訊有人接
- **跳過**：純後端 / 純邏輯改動（且不觸發上述 OR 條件）→ 直接進 Step 6.7 註解整理
- **跳過**：**純樣式 changeset**（只動 `<style>` 區塊或純樣式檔）→ 不觸發本步驟——樣式改動驗不出「流程斷裂」這類信號，UI/UX 面向交給 Step 6 Reviewer 的 `web-design-guidelines` 把關

**與 Reviewer 的關係（序列，不平行）**：統一原則——**靜態關卡（測試＋review）跟著每一次修復重新蓋章；動態關卡（本步驟）永遠壓軸，驗的必是最終 code**。Step 6 Reviewer 迴路**完全 settle**（含 targeted re-check 通過）後，才派發本步驟；因此本步驟的 PASS 不可能過期，不需要任何「綠燈作廢」規則。本步驟 FAIL 的修復走完整靜態關卡後才 targeted re-run（見 Retry 迴路「操作流程驗證 FAIL」）。取捨：快樂路徑 wall-clock 由 max(review, verify) 變為兩者相加——自主 pipeline 無人即時盯梭，wall-clock 是最便宜的貨幣，規則才是永久 drift 面。

**前置**：orchestrator 確保 dev server 正在跑（或在 prompt 告知啟動方式）；功能在登入牆後時，提供「已驗證入口」（dev session / seeded cookie / auth bypass），或（登入本身是被測流程時）測試帳號。

使用 Task tool 派發 subagent，固定 **`subagent_type: general-purpose` + `model: sonnet`**。載入 `code-verify-flow` skill，由其 subagent prompt 模板驅動；orchestrator 注入：變更名稱、app URL / 啟動方式、驗收依據（`openspec/changes/{changeName}/specs/`）、已知的重點元件 / 位置、必要時的已驗證入口或測試帳密。判準、輸出格式、preflight、登入牆與反 rabbit-hole 規則皆見 `code-verify-flow` skill，此處不重複。

**verdict 分支**：

- **PASS** → 進 Step 6.7（Reviewer 已於本步驟前 settle）
- **FAIL**（流程斷 / console error / spec 明文元件或位置不成立；判 FAIL 前 agent 已依 `code-verify-flow` 做過重現確認）→ 進 Retry 迴路回 Coder 修（見下方「操作流程驗證 FAIL」）
- **flaky 標註**（一次性錯誤、重現不出）→ 不打回 Coder、不計 retry；orchestrator 把標註原樣帶進 Step 7 報告，交人工驗收確認
- **BLOCKED**（不計 retry，報告須註明子原因）：
  - **工具未就緒**（Chrome 沒裝 / 沒連 claude-in-chrome）→ **跳過本步、退回純人工驗收**，報告註明「未能自動驗證，請人工走一遍」。**不當 FAIL**（別打回 Coder）、**不靜默放行**，不阻斷交付
  - **環境**（dev server / seed data / 連不上）或 **登入牆**（缺測試帳號 / 第三方 OAuth / SSO / CAPTCHA / 2FA / 魔術連結）→ 停下來問人

**Subagent 派發失敗時**：判為 BLOCKED（工具未就緒）處理——跳過本步、退回人工驗收，不退化為主對話自做。

### Step 6.7: 註解整理（Sonnet subagent）

Reviewer 判定 PASS（含 WARNING re-check 完成）、且操作流程驗證 gate 已綠（PASS 或因工具未就緒而跳過）後、報告結果前，派發一次註解整理 Agent，清除本次 Pipeline 累積的過時／疊加／思考流程註解。

- 載入 `code-comment` skill 取得整理規範與輸出格式
- 使用 Task tool 派發 subagent，固定 **`subagent_type: general-purpose` + `model: sonnet`**
- scope 為「本次 Pipeline 修改的檔案清單」（即 Coder 各批產出 + Tester 測試檔），由 orchestrator 注入 prompt 的 `{changedFiles}`，subagent 不需自行偵測 diff
- 整理 Agent 依守則**直接套用 Edit**並自跑 lint --fix（指令依專案偵測，優先 `pnpm lint --fix`，不寫死 `npx`；不可刪除功能型指令註解，如 `eslint-disable`、`@ts-expect-error`、`istanbul ignore`、`v-html` 安全註記）
- 整理完成後，**orchestrator 重跑一次測試**（專案 test script，如 `pnpm test`）作為安全網——純註解改動不該破壞行為，失敗多半是誤刪到功能型註解，回整理 Agent 修正（最多 1 輪），仍失敗 → 停下來問人。注意此安全網接不住 build-time pragma（`@__PURE__`、`webpackChunkName` 等）的誤刪——測試驗不到，靠 `code-comment` 保護清單防守

放在所有 gate（Reviewer + 操作流程驗證）settle 之後的理由：retry 迴路中 Coder 多次修復會持續疊加註解，待全部 settle 後一次清理最終狀態最乾淨。註解改動風險低、不動 code 邏輯，故不需重跑 Opus Reviewer 或操作流程驗證（純註解改動不會弄壞走得通的流程）；ESLint + 測試即足夠安全網。

### Step 7: 報告結果

顯示 Phase 2 完成摘要（含操作流程驗證報告中的 flaky 標註與待人確認項），提示進入 Phase 3 人工驗收。

報告輸出後，**主動刪除**本次 change 在 `.claude/debug/` 的殘留檔（驗證截圖、除錯檔）——檔案價值僅在執行中；`.claude/` 應由專案 gitignore 蓋掉，不進版控。

---

## Retry 迴路

### 測試失敗 → Coder 修復

1. 將以下資訊傳給修復 Coder：
   - 失敗的測試名稱和錯誤訊息
   - **前一輪 Coder 的輸出摘要**（修改的檔案清單 + 關鍵設計決策）
   - 明確的修復指示
2. **申辯通道（test-defect）**：retry prompt 明文允許——Coder 判斷失敗原因是「測試與驗收依據不符」時（不論該測試是誰寫的：Tester 新寫的、Coder 自己先前順手寫的、更早批次留下的），可回報 test-defect，**必須引用驗收依據原文**（spec scenario／design 段落，含來源路徑）並指出斷言不符之處；**引不出原文不受理**，乖乖修 code。主對話收到申辯 → **改派 Tester 修測試**（測試檔的守護者一律是 Tester，不論原作者是誰）；Tester 可反駁（同樣須引依據）。權力結構：Coder 有**上訴權**無**裁判權**（無權動測試檔）；真正的裁判是驗收依據原文（SDD 權威結構：spec 說了算），終審是人（3 輪停損）。上訴輪照計 counter——豁免防不了互踢，且需要第二本帳
3. 修復 prompt 須明確指示：**不需重讀 design.md / specs/**，只讀前輪輸出摘要、失敗報告、要修改的檔案（**升 Opus 那輪解除此限制**，見「免重讀 escape hatch」）
4. 修復 Coder settle 前**自跑三件套**：lint + typecheck + 專案 test script（如 `pnpm test`）。lint／型別紅燈就地修（不計 retry）；測試仍紅且屬 code 問題 → 就地修；就地修不掉或判斷是測試問題 → 回報主對話（走本迴路下一輪或申辯通道）
5. 三件套全綠即 settle，**不重派 Tester**——修復後防的是機械回歸，跑套件即可偵測；Tester 的獨立價值在首輪設計測試
6. counter 依「Retry 計數（統一判準）」記帳；counter ≥ 2 起修復派發升 Opus（見「修復派發 Model 升級」）；最多 3 輪，修不好 → 停下來問人

### Review FAIL（有 CRITICAL）

依問題歸屬派發修復：
- 程式碼品質問題 → Coder Agent 修復
- 測試品質問題 → Tester Agent 修復
- 安全性問題（嚴重）→ 停下來問人

修復 agent 的 prompt 需包含前一輪的輸出摘要（檔案清單 + 設計決策），避免 context 斷裂。**修復 agent 不需重讀 design.md / specs/**，只讀前輪輸出摘要、Review 報告、要修改的檔案（**升 Opus 那輪解除此限制**，見「免重讀 escape hatch」）。spec alignment 類 finding 已依 `code-review` 規範附上被違反的 spec 段落原文——orchestrator **全文轉遞**，修復 agent 的 prompt 直接含權威依據，不必重讀 spec 檔。

修復 agent settle 前**自跑三件套**（lint + typecheck + test；紅燈就地修不計 retry，就地修不掉 → 回報主對話走測試迴路記帳）。修復後重新派發 Reviewer Agent 驗證。最多 3 輪。

#### Reviewer 輪次追蹤 + Adversarial 升級

- Orchestrator 在整個 Pipeline 內維護一個獨立的 **Reviewer retry counter**（初始為 0）
- counter 累計規則（依 **Opus Reviewer** 派發結果分支，僅 FAIL 才 +1）：
  - **PASS** → counter 不變，Step 6 結束
  - **PASS with WARNING** → counter 不變，進 WARNING re-check 流程（見下方）
  - **FAIL** → counter +1，進 Coder/Tester 修復 → 重派 Opus Reviewer
- **Targeted re-check（Sonnet）不計入 counter**，無論其結果 PASS / FAIL——它走自己的 3 輪上限（見下方 PASS with WARNING 段）
- counter ≥ 2 時，**下一輪 Opus Reviewer 派發強制帶 `{adversarial}=true`**，不論 Step 6 首次派發時的 adversarial 判定如何
- counter ≥ 2 時，本迴路的**修復派發強制升 opus**（統一規則，見「修復派發 Model 升級」）
- counter 在同一 Pipeline 內持續累計，不會因 Coder/Tester 修復成功而重置
- counter 達到 3（即第 3 輪 Opus Reviewer 仍 FAIL）→ 停下來問人

### 操作流程驗證 FAIL → Coder 修復（修復走完整靜態關卡）

僅在 Step 6.5 派發（觸及 UI/流程）且回報 FAIL 時進入（判 FAIL 前 agent 已依 `code-verify-flow` 做過重現確認；重現不出 → 標 flaky 不進此迴路）。

- 將以下傳給 Coder：驗證報告（走到哪斷了 / 哪個元件沒出現 / 跑錯區域 / console error，含截圖或幾何描述）+ **前一輪 Coder 輸出摘要**（檔案清單 + 設計決策）+ 明確修復指示
- Coder prompt 指示：**不需重讀 design.md / specs/**，只讀前輪摘要、驗證報告、要改的檔（升 Opus 輪解除，見「免重讀 escape hatch」）
- **修復走完整靜態關卡再壓軸重驗**：Coder 修復 → settle 前自跑三件套（lint + typecheck + test，紅燈就地修）→ **review targeted re-check**（既有 Sonnet re-check 機制：只審修復 diff、驗證修復正確且未引入新問題，counter 記帳沿用既有規則不吃 Opus counter）→ 通過後 **verify-flow targeted re-run**（只重走受影響流程）
- 「Coder 修復 → 靜態關卡 → 流程 re-run」小迴路最多 3 輪，仍 FAIL → 停下來問人；counter ≥ 2 起修復派發升 Opus（統一規則）
- **BLOCKED 不進此迴路**：工具未就緒 → 跳過本步退回人工驗收；環境 / 登入牆 → 停下問人，皆不計 retry。**flaky 標註**亦不進此迴路、不計 retry，寫進報告交人工驗收確認

### Review PASS with WARNING

- WARNING 視為需修復
- **同一歸屬的所有 WARNING 合併為一個修復任務**（Coder 一次收到所有歸屬它的 WARNING 清單，一次改完）
- 問題歸屬：實作代碼 → Coder，測試代碼 → Tester
- Coder 和 Tester 的修復任務若同時存在，可平行派發
- 修復後的 re-check 使用 **Sonnet model**（非完整 Opus Reviewer）
- re-check agent 同樣載入 `code-review` skill，但執行 targeted check 模式：只讀取改動的檔案和行數，驗證修復是否正確，不重新掃描所有 artifacts

**Targeted re-check 結果分支**：

- **PASS** → WARNING 修補完成，Step 6 結束
- **FAIL**（WARNING 修補未到位 或 引入新問題）→ 依 re-check 報告中的歸屬，**回 Coder/Tester 再修一次**，修完後重派 Sonnet targeted re-check（仍不計入 Opus counter）
- 「Coder/Tester 修復 → targeted re-check」這個小迴路最多 3 輪，仍 FAIL → 停下來問人
- **此迴路不升級為 Opus 完整 review**——既然 Opus 已判定 PASS with WARNING（無 CRITICAL），重派 Opus 不會改變判定結果；繼續維持 Sonnet targeted re-check 直到修補完成或達 3 輪上限

### Retry 計數（統一判準）

**計一圈的定義**：「品質失敗回到主對話、需要派 agent 去修」＝該迴路 counter +1。test-defect 上訴輪同樣計——豁免防不了互踢，且需要第二本帳。counter 語義＝「迴路為修品質問題轉了幾圈」，不做過錯歸屬；上訴燒配額會加速拉人進場——連「什麼是對的」都有爭議的批次，本該更早見人。

**不計**：
- ESLint / typecheck 自修（agent 就地修，未回主對話）
- 修復 agent 自跑三件套的就地修（同上）
- BLOCKED（回到主對話是為了問人，不是品質失敗）
- flaky 標註（回到主對話是為了告知）
- targeted re-check / targeted re-run（驗證派發，非問題回報；re-check 小迴路自有 3 輪上限）

**各迴路上限（獨立計數，迴路分帳）**：測試迴路 3 輪、Opus Reviewer 3 輪、targeted re-check 小迴路 3 輪、操作流程驗證小迴路 3 輪。達上限 → 停下來問人（問題可能較嚴重或 AI 忽略關鍵細節）。

### 修復派發 Model 升級（統一規則）

**同一迴路 counter ≥ 2 起，該迴路的修復派發升 Opus**——測試迴路、Reviewer 迴路、操作流程驗證迴路一體適用（Tier 2 同款規則見 `code-fix`）。綁「派發」不綁「角色」：上訴輪的修復派發可能是 Tester（修測試），同一訊號——連 2 輪未收斂＝非表層問題——對誰被派去修都成立。升級後該 Pipeline 內不再降回（棘輪）。Reviewer 自身固定 Opus，無升級問題。

**免重讀 escape hatch**：升 Opus 的那一輪**解除**「不需重讀 design.md / specs/」限制——連兩輪修不好，問題大概率不在表層 code 而在設計/規格理解，判定「需要深度推理」的同時給足材料。是**解禁不是強制**：Opus 自行判斷要不要讀、讀哪份（範圍含 design.md 與 specs/）。前兩輪維持免重讀，context 經濟原則不動。此原則**綁訊號不綁迴路**：任何迴路的升 Opus 輪皆適用。

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

Orchestrator 在宣告阻塞前，輸出 debug 檔案 `.claude/debug/{changeName}-{timestamp}.md`（不放專案根目錄——檔案含完整 diff，`.claude/` 應由專案 gitignore 蓋掉；生命週期見 Step 2 lazy cleanup 與 Step 7 主動刪）：

```markdown
## Pipeline 暫停：{changeName}

### 阻塞原因
{最後一輪的錯誤訊息}

### Retry 歷程

#### Round 1
- Coder 修改：{檔案清單}
- 結果：{失敗原因}

#### Round 2
...

#### Round 3
...

### 當前 Diff
（附上 git diff 輸出）
```

然後向使用者顯示阻塞摘要：

```
## Pipeline 暫停：{changeName}

### 問題
{問題描述}

### 已完成
- Coder: ✓
- Tester: ✗ 第 3 輪仍失敗

### Pipeline 統計
- Coder 派發次數：{coderCalls}
- Tester 派發次數：{testerCalls}

### Debug 檔案
已輸出至 .claude/debug/{changeName}-{timestamp}.md

### 選項
1. 人工介入修復
2. 調整 spec/design 後重跑
3. 其他
```

---

## Guardrails

- 每個 agent 的 prompt 只傳變更名稱和目錄，讓 agent 自行讀取 artifacts
- Coder（含 retry 派發）一律先載入 `code-guidelines` 行為守則再動手——從生成端約束過度設計與越界改動
- 不在 prompt 中貼入檔案內容
- Coder 的輸出（檔案清單 + 設計決策）由 orchestrator 保留，用於傳遞給後續 agent 和 retry
- Retry 迴路中，附帶前一輪的輸出摘要，避免 context 斷裂導致重複犯錯
- 同歸屬的 WARNING 合併為一個修復任務，減少不必要的來回
- 獨立的修復任務可平行派發，**前提是修復檔案集不相交**（如 Coder 與 Tester 各修不同檔案的 WARNING）；檔案相交或無法確定 → 串行
- 任何 gate FAIL 的修復完成後，修復 agent settle 前一律自跑三件套（lint + typecheck + test）——靜態關卡跟著每一次修復重新蓋章
- Coder / Tester 派發本身失敗或中途中斷 → 以 `git status` 對照 tasks.md checkbox **對帳實際完成度**後再重派（磁碟優先，不憑對話記憶推測進度）
- 3 輪上限後必須停下來問人，不可繼續嘗試
- Pipeline 開始前確保在功能分支上，不直接在主要分支開發
- 操作流程驗證僅在觸及 UI/流程時派發，**在 Reviewer 迴路完全 settle 後壓軸執行**（動態關卡永遠驗最終 code）；FAIL 的修復走完整靜態關卡再 targeted re-run，工具未就緒→跳過退回人工驗收（不當 FAIL、不靜默放行），環境/登入牆→問人，flaky 標註交人工驗收。它是人工驗收的前置過濾器，不取代人工驗收
- 註解整理在所有 gate（Reviewer + 操作流程驗證）settle 之後執行，只動註解不動 code 邏輯，整理後必重跑測試作為安全網
- Pipeline 完成後不自動 commit，等人工驗收通過後再走交付流程
- WARNING re-check 使用 Sonnet 而非 Opus，存在品質判斷閾值差異的風險——Sonnet 可能將 subtle issue 判定為已修復。若同一 WARNING 在 re-check 後人工驗收時再次出現，應考慮升級為 Opus 完整 review
