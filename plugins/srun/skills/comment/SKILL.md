---
name: comment
argument-hint: "[--staged | --branch <name> | --whole-file]"
description: Use when tidying code comments at the end of development — removes stale/redundant/thinking-process comments while preserving "why" comments, conventions, and functional directives
---

獨立的「註解整理」skill，定義註解衛生的判準、流程與輸出格式。透過 Task tool 派發 **Sonnet 整理 Agent subagent** 執行，提供與主對話隔離的 fresh-eyes 視角——避免「剛寫完註解的人最難判斷哪些是廢話」的自評盲點。可在任何場景獨立呼叫，也作為 `feat`／`fix` 開發收尾步驟的單一規範來源。

**Input**: 可選指定範圍（見下方模式）。未指定時自動偵測 git diff。

**Model 策略**：整理 Agent 走 Sonnet subagent。註解判定屬機械性偏多的工作，不需 Opus 深度推理；subagent context 與主對話隔離取得 fresh eyes，又成本低。

**為什麼是「直接修復」而非「只回報」**：本 skill 的目標是開發收尾自動清乾淨。與 `review`（report-only + STOP 規則）不同，整理 Agent 依守則**直接套用 Edit**，完成後回報它改了什麼。理由：註解改動不動 code 邏輯、風險低；但**刪除是危險方向**，故守則對「不可刪」與「拿不準就留」訂得很死（見下方）。

---

## 整理模式

根據輸入自動判斷：

```
/srun:comment                    → 自動偵測：git diff 未 commit 的變更
/srun:comment --staged           → 只看 staged changes
/srun:comment --branch feat/xxx  → 整個 branch 相對 main 的 diff
/srun:comment --whole-file       → 獨立模式下放寬到整個改動檔案（預設只清 diff 鄰近區）
```

被 `feat`／`fix` 收尾步驟載入時，由呼叫方 prompt 指定範圍（通常是「本次 Pipeline 修改的檔案清單」），不需自動偵測。

**掃描邊界（重要，避免失控）**：

- 只處理「本次開發改動到的檔案」，不掃整個 repo；不碰改動檔案以外的檔案
- **獨立模式預設只處理 diff 改動區及其鄰近註解**——避免誤傷他人 ownership 的舊程式碼。加 `--whole-file` 才放寬到整個改動檔案
- **Pipeline 模式**（被 `feat`／`fix` 載入）：改動檔案是這條 Pipeline 自己寫出來的，無 ownership 誤傷疑慮，允許清整個 changed file 內明顯的垃圾註解（冗餘複述、思考流程、註解掉的死碼），不限 diff 鄰近區

---

## 流程

### Step 1: 準備

1. 讀取專案的 CLAUDE.md 了解專案慣例（特別是註解語言慣例）
2. 依模式確認變更範圍：
   - 自動偵測：`git diff` + `git diff --staged`
   - `--staged`：`git diff --staged`
   - `--branch`：`git diff main...<branch>`

### Step 2: 派發整理 Agent Subagent

使用 Task tool 派發 subagent，派發參數固定為 **`subagent_type: general-purpose` + `model: sonnet`**。prompt 模板見下方「整理 Agent Subagent Prompt 模板」，依模式注入對應 scope。

Subagent 自行讀檔、自行依守則套用 Edit、自行跑 lint --fix（指令依專案偵測），最後直接輸出本 skill 定義的「輸出格式」報告。主對話收到後直接呈現。

**Subagent 派發失敗時**：記錄錯誤並停下來問人，不退化為主對話自做（破壞 fresh-eyes 隔離初衷）。

### Step 3: 呈現結果 + 安全網

主對話將整理 Agent 的報告原樣呈現，並確認安全網已執行：

- **保護清單前後計數**：subagent 於整理前後對功能型指令保護清單**逐 pattern** regex 計數並核對（見 prompt 模板）——任一 pattern 變少即誤刪，補回才 settle。這是 build-time pragma（測試驗不到）的機械防線
- **Lint --fix**：由 subagent 在收尾時執行（指令選用見下方安全網引用的 `command-conventions.md`）
- **重跑測試**：純註解改動理論上不影響行為，但仍應重跑既有測試——**大多數誤刪**功能型指令註解（如 `eslint-disable`、`@ts-expect-error`、`istanbul ignore`）**會在此暴露；build-time pragma（`@__PURE__`、`webpackChunkName` 等）除外**——它們只影響打包結果，測試驗不到，靠保護清單防守。被 Pipeline 載入時，由 orchestrator 在整理後重跑測試；獨立模式由 subagent 跑專案 test script 並回報。

---

## 整理 Agent Subagent Prompt 模板

本章節是註解判準、修正方式、輸出格式的 **single source of truth**——所有規範均內嵌於下方 prompt 模板。

**模板展開規則**（派發前必做，與 `review` 一致）：

1. `{變數}`（如 `{auto | staged | branch:<name>}`、`{changedFiles}`）一律以實際值替換為單一具體字串
2. `{scanRange}` 依模式填：獨立模式且無 `--whole-file` → 填「僅 diff 改動區及其鄰近註解」；`--whole-file` 或 Pipeline 模式 → 填「整個改動檔案」
3. `{若...：}` 條件區塊：條件成立時刪掉標頭、保留內文；不成立時整段刪除（直到下一個 `---` 或下一個 `{若...：}` 標頭）
4. 派發前目視確認模板已展開乾淨，不留任何 `{...}` 字串

```
你是註解整理 Agent，使用 fresh-eyes 視角整理本次開發產生的程式碼註解。

Scope：{auto | staged | branch:<name> | files}
{若被 Pipeline 載入：}
本次 Pipeline 修改的檔案：
{changedFiles}

---

開始工作前：

1. 讀取專案的 CLAUDE.md，理解專案慣例（特別注意：註解使用的語言慣例）
2. 取得本次改動範圍：
   - auto: `git diff` 與 `git diff --staged`
   - staged: `git diff --staged`
   - branch: `git diff main...<branch>`
   - files: 上方列出的檔案清單
3. 讀取改動到的檔案完整內容（判斷註解是否冗餘、是否與 code 相符，需要完整 context）

掃描邊界：
- 只處理本次改動到的檔案，不掃整個 repo；不碰本次未改動的其他檔案
- 整理範圍：{scanRange}

---

## 核心判準

註解的價值在於補充「code 無法自我表達」的資訊——以「功能完成後、不知道開發過程的讀者」視角評估：凡是讀 code 本身（含語意化命名、結構，必要時對照鄰近檔案如 CSS／型別）就能在合理成本內看懂的 → 冗餘；唯有說明意圖／原因／陷阱、跨越開發期仍成立的 why → 保留。判準不是「寫的當下有沒有價值」，而是「留在成品裡對未來讀者有沒有增益」。**刪除是危險方向，拿不準就保留並列入保留決策覆核。**

### 要清除／修正的註解（bad patterns）

| 類型 | 特徵 | 修正動作 |
|------|------|---------|
| 過時／矛盾 | 註解描述的行為與當前 code 不符（code 改了註解沒跟上） | **若仍有 why／限制／非直覺價值，改寫成與當前 code 一致的說明；否則直接刪除**（不要為了「補上正確版」而產生只複述 code 的新註解） |
| 疊加殘留 | 同一處堆了多代修改的註解、或新舊並存 | 只留最新且正確的一份 |
| 思考流程／對話口吻 | 「先這樣試試」「為了通過測試所以…」「根據需求改成…」「這裡暫時…」等敘述開發思考而非說明 code | 刪除；若內含真實意圖則改寫成「為什麼」式說明 |
| 冗餘複述 | 複述已由命名／結構表達的作用——含字面直譯（`count++ // 計數加一`）與語意複述（`// 品牌大圖覆蓋層` 對 class `logo-page-overlay`） | 刪除 |
| 註解掉的死碼 | `// const old = ...` 整段被註解的舊程式碼 | 刪除（git 已保有歷史） |
| 空泛 TODO／佔位 | `// TODO: 之後再說`、`// ...` 無可執行資訊 | 刪除 |

### 必須保留（不可誤刪）

- **解釋「為什麼」**：權衡、workaround、踩過的雷、非直覺決策、業務規則來由
- **公開 API 文件**：JSDoc / docstring / 對外介面說明
- **複雜演算法或非直覺邏輯**的說明
- **功能型指令註解（一律保留，刪了會改變行為/建置/coverage，且一般測試不一定抓得到）**：
  - Linter/格式器：`eslint-disable*`、`prettier-ignore`、`biome-ignore`、`stylelint-disable`
  - TypeScript：`@ts-expect-error`、`@ts-ignore`、`@ts-nocheck`、type-only import 註記
  - 測試/coverage：`@vitest-environment`、`istanbul ignore *`、`c8 ignore`、`v8 ignore`、其他 coverage ignore
  - Bundler/編譯 pragma：`@__PURE__`、`@jsx`／`@jsxImportSource`、`@vite-ignore`、`webpackChunkName` 等 magic comments、`@preserve`／`@license`
  - 框架：`v-html` 安全註記、`<!-- eslint-disable -->` 等 template 內指令
  - 拿不準某註解是否為功能型指令時 → 一律保留
- **法律／授權標頭**
- **具體且對應真實待辦的 TODO/FIXME**（有明確內容者）

判定原則：
- 對照 diff：鄰近註解須與新 code 一致，不一致即過時，更新或刪除
- 修正優先精簡為一句意圖/限制/非直覺原因，而非無腦全刪；**別把過時註解改寫成只複述 code 的 what-comment**（用新冗餘換舊冗餘）
- borderline（拿不準是否含「為什麼」價值）→ **保留**，列入報告「保留決策」段供覆核
- 不改 code 邏輯，只動註解；不調整與註解無關的格式

## 保護清單前後計數（機械不變量，必做）

build-time pragma 誤刪測試驗不到，靠這道機械網防守。**開始整理前**，對上方「必須保留」清單的每種功能型 pattern（`eslint-disable`、`prettier-ignore`、`@ts-expect-error`、`@__PURE__`、`webpackChunkName`、`v-html` 註記等全部項目）在 scope 檔案內各跑一次 regex 計數；**整理完成後**同樣再數一次，**逐 pattern 核對**（不加總——總數不變可能是 A 少一、B 多一互相掩護）：

- 任一 pattern 計數變少 → 誤刪了該種標記，找回補上後重新核對，**全部相等才 settle**
- 只數保護清單內的 pattern，一般註解不管（測試網接得住，不重複防）
- 純機械、零判斷，成本趨近零

---

依守則對改動檔案逐處套用 Edit。全部完成後跑安全網（指令偵測與選用見 `${CLAUDE_SKILL_DIR}/../feat/references/command-conventions.md`，開工前讀）：

1. Lint：跑專案 lint script（需要時帶 `--fix`），確保被你動過的檔案通過 lint
{若獨立模式（非 Pipeline 載入）：}
2. 測試：跑專案 test script 確認純註解改動未破壞既有測試——大多數誤刪功能型指令註解會在此暴露；build-time pragma（`@__PURE__`、`webpackChunkName` 等）除外，測試驗不到，靠上方保護清單防守

---

輸出格式（直接是最終格式）：

## 註解整理：{scope 描述}

### 整理摘要

清除 {N} 處、改寫 {M} 處、保留待覆核 {K} 處。

### 變更清單

| # | 檔案:行號 | 類型 | 動作 | 摘要 |
|---|----------|------|------|------|
| 1 | foo.ts:42 | 過時 | 改寫 | `// 回傳陣列` → `// 回傳去重後的清單` |
| 2 | bar.vue:88 | 思考流程 | 刪除 | `// 先這樣試試看` |
| 3 | baz.ts:10 | 冗餘複述 | 刪除 | `count++ // 加一` |

### 保留決策（borderline）

（拿不準但決定保留的，列出讓人覆核；無則寫「無」）

- foo.ts:30 — `// 這裡要用 nextTick 否則 ref 還沒更新` → 保留（解釋 why，非冗餘）

### 安全網

- 保護清單計數：{前後逐 pattern 一致 | 曾發現 {pattern} 減少，已補回並複核一致}
- Lint --fix：通過 / 修正 N 處
{若獨立模式：}
- 測試：{通過 M / 失敗 X}

### 摘要

{1-2 句整體說明，例如「本次清除以 Coder 思考流程註解為主，無誤刪功能型指令」}
```

---

## 與 Pipeline 的關係

| 使用者 | 如何使用 |
|--------|---------|
| `feat`（Tier 3）收尾 | Reviewer PASS 後，orchestrator 派發 Sonnet 整理 Agent subagent，載入此 skill 取得規範；整理後重跑 lint + 測試，再進交付 |
| `fix`（Tier 2）收尾 | Coder/Tester settle 後、Spec 影響檢查前，orchestrator 派發整理 Agent |
| 獨立使用 | 任何時候對任意 diff 執行 `/srun:comment` |

此 skill 只負責「怎麼判斷與整理註解」與「派發給誰」。在 Pipeline 中的位置、重跑測試的時機由呼叫方（`feat`／`fix`）管理。
