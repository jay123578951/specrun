---
name: feat
argument-hint: "[change-name]"
description: 完整 Pipeline：實作完整功能、改變模組邊界的重構（抽出共用介面、調整依賴方向）、架構變更，或需要 spec 記錄的變更時使用；需 spec 記錄＝新增 API/元件（介面契約本身即規格，與行為簡繁無關）、行為值得規格化、決策收斂成本高（分支彼此相依，一題的答案會改變另一題的選項）、需拆批。決策已在對話收斂且不動模組邊界的小改動改用 fix。
---

完整版 Agent Pipeline，適用於需要設計決策的完整功能（新功能、改變模組邊界的重構、架構變更）。透過 OpenSpec 變更 artifact 驅動，派發三個專職 agent 分工執行。

小改動請改用 `/srun:fix`（輕量版）。

**Input**: 可選指定變更名稱（e.g., `/srun:feat add-auth`）。未指定時從對話推斷或提示選擇。

---

## 流程總覽

各步驟的觸發條件與參數判定寫在步驟內文，這裡只列順序與去向。

```
Step 1–2.5  選 change、確認 artifact、開工作分支
Step 3      分批、判定 Coder model
Step 4      Coder（sonnet／opus）實作
Step 5      Tester（sonnet）稽核與補測試            失敗 → Retry 迴路
            分批時每批跑 Step 4–5，全部批次跑完才進 Step 6
Step 6      Reviewer（opus-reviewer）               有待修項 → Retry 迴路，直到這關修完
Step 6.5    操作流程驗證（sonnet，觸及 UI/流程才跑）  FAIL → Retry 迴路
Step 6.7    收驗證環境、規格缺口回寫（主對話自做）
Step 7      報告、retro 記錄、跳驗收選項 → 交人工驗收
```

### 派發說明（每次派發前）

每次用 Agent tool 派發前，先在對話輸出一行派發說明，再呼叫工具：

- 只寫靠條件判斷決定的參數，每個參數附理由；理由要對應本檔的條件原文
- 各派發要寫的參數：
  - Coder 首派：model 與理由；本批 task 範圍
  - Reviewer：adversarial 與理由；追加 skill 與理由
  - 操作流程驗證：跑或不跑與理由（含 Step 6.5 的強制例外）；帶哪些走法交接檔。判定不跑時也要寫這一行
  - 修復派發：哪一關第幾輪；升級模式開了沒（決定 model）；誰修、修哪幾項；同型位置清單有無
- Tester 首派、targeted re-check 的參數固定，不寫
- 格式範例：
  - `→ 派 Reviewer｜adversarial：否（沒碰安全敏感路徑、無 schema 變更）｜追加 skill：web-design-guidelines、antfu-design（改了 UnoCSS 元件）`
  - `→ 派 Coder 修復｜Reviewer 第 2 輪｜升級模式：開 → opus（Reviewer 第 2 次 FAIL）｜修 W1、W3｜同型位置：無`

---

## 流程

### Step 1: 選擇變更

1. 若有提供名稱，直接使用
2. 否則從對話推斷，或讀取 `openspec/changes/` 目錄列出進行中的變更讓使用者選擇
3. 宣告：「Using change: <name>」

### Step 2: 確認狀態

確認變更目錄 `openspec/changes/<name>/` 存在，且 `tasks.md` 已產出：

- 變更目錄不存在或缺少 `tasks.md` → 提示先用規格後端產出 artifact（如 `/opsx:propose` 或 `/spectra-propose`）
- `tasks.md` 必須存在才能繼續

**起跑髒檢查（advisory，不硬擋）**：檢查 working tree——若 `openspec/` **以外**存在與本次變更無關的未 commit 修改，提醒使用者確認後再續跑（無關髒變更會混進 Coder 的 diff 與後續 gate 的檢查範圍）。`openspec/` artifacts 刻意不 commit，排除在判準外。

**`.claude/debug/` lazy cleanup（備援）**：掃 `.claude/debug/` 目錄，凡對應的 `openspec/changes/<name>/` 已不存在者（change 已歸檔或放棄）刪除其殘留檔；change 仍在者不刪——那可能是上次中斷要接手的線索。

### Step 2.5: 基準分支與工作分支

`{baseBranch}` ＝ 開工作分支前所在的分支（main、dev、個人長期分支皆同；接手既有 `feat/{changeName}` 時以其分岔來源為準），供 Reviewer 的 diff 基準與髒檢查用。不用 origin/HEAD 推：遠端主幹可能落後所在分支許多不相關 commit。

一律從所在分支開 `feat/{changeName}`；唯一不另開的情況是當下已在本 change 自己的 `feat/{changeName}` 上（中斷接手）。

### Step 3: 評估任務規模與分批策略

讀取 tasks.md，以 **Task 大項（T1、T2、T3…）** 為單位評估：

- **單一大項**：整批派發給一個 Coder Agent
- **多個大項**：每個大項為一批，獨立走 Coder → Tester 流程，全部完成後再跑一次完整 Reviewer
- **大項之間有依賴關係時**（如 T2 使用 T1 產出的模組），按依賴順序串行執行
- **大項之間無依賴時**，可平行派發

依賴判斷優先從 task 描述推斷。**若無法明確判斷，預設為串行執行（保守策略）。** 只有在 orchestrator 確信無依賴時才平行派發。

不以 checkbox 數量切分，避免把同一模組的邏輯拆散到不同 agent。

**跨批 Context 注意事項**

串行執行時，後續批次的 Coder prompt 須額外包含：
- 前批產出的檔案清單
- 前批 Coder 的關鍵設計決策摘要（來自 Step 4 的輸出）
- 前批 Coder 回報的規格缺口（後批遇到同一情境沿用同一選擇，不各批各選）

目的：確保後批 agent 沿用前批建立的介面與慣例，而非僅靠讀取原始碼推斷。

Retry 修復時，若修改涉及跨批共用的介面（如共用模組的回傳結構），orchestrator 應重跑受影響批次的測試。

**驗證型 task 對應到 gate**

tasks.md 中的驗證型 task（畫面走查、完整性複查、review 類項目）**不派給 Coder 實作**，它們已由 pipeline 的 gate 覆蓋：

- 對應方式：畫面走查 → 操作流程驗證；完整性／review 類 → Reviewer；測試類 → Tester
- 該 gate 綠燈後，由 orchestrator 代為勾選，並在該行註記「由 gate 覆蓋」
- 對應不到任何 gate 的驗證型 task，列入 Step 7 報告的「要你親手驗的」

**Coder Model 升級判定**

Step 4 **首次**派發 Coder 前判定 `{coderModel}`。下列任一成立、事先就可預期需要深度推理時升 `opus`，其餘維持 `sonnet`，判定保守：

- 跨模組邊界的架構變更／大型重構
- 安全敏感路徑：auth、payment、API key 處理、session 管理（與 Step 6 adversarial 判定共用這份清單）
- design.md 把較多實作方式留給 Coder 自行決定

判定結果連同理由記進 Step 7 的 retro 條目（`guards.coderStart`）：固定詞彙 `architecture`／`security`／`design-open`，維持 `sonnet` 記 `null`。這是前置判定成效的唯一分母，記錄口徑見 `srun:retro`。

本判定只管首次派發；修復派發的 model 由「Retry 迴路」的升級模式決定。

### Step 4: 派發 Coder Agent

派發前準備：

- `{commandConventionsPath}`：代入 `${CLAUDE_SKILL_DIR}/references/command-conventions.md` 的**絕對路徑**
- `{handoffPath}`：代入 `.claude/debug/{changeName}-交接.md`
  - 串行各批共用這一個檔
  - 平行各批在檔名後加批次代號（如 `-交接-T1.md`），以免互相覆蓋
- 本 run 第一次派發前，刪掉 `.claude/debug/{changeName}-交接*.md`：那是上次 run 依當時程式碼寫的，不能沿用

使用 Agent tool 派發 subagent（model: {coderModel}）：

```
你是 Coder Agent。

變更名稱：{changeName}
變更目錄：openspec/changes/{changeName}/
實作範圍：{taskList}（若為分批模式，僅列本批 task）

開始工作前：
1. 用 Skill tool 先載入 `srun:guidelines`（寫 code 的行為守則，務必先讀再動手），再從你 context 的 available-skills 挑選與專案 stack、本次改動相關的知識型 skill 載入（開發慣例、程式碼風格、元件拆分守則等）；載入失敗（缺裝／改名）→ 略過該項繼續，不要停
2. 讀取專案的 CLAUDE.md 了解專案慣例
3. 讀取變更目錄下的 design.md、tasks.md 和 specs/ 下的 delta spec 檔案

依照指定的 task 逐項實作：
- 遵循專案設計系統與慣例
- 善用既有的共用模組與 utils
- 每完成一個 task，更新 tasks.md 的 checkbox：`- [ ]` → `- [x]`
- 允許順手撰寫自證用的測試（不強制）；正式的測試設計與稽核由 Tester 負責

完成後依序執行 lint 與 typecheck（指令選用一律依 {commandConventionsPath}；錯誤自行修復，不計 retry）

輸出（第一行自報你實際使用的 model，格式：`Coder model: <id>`；缺這行視為報告不完整）：
1. 列出你建立/修改/刪除的所有檔案路徑
2. 簡述每個 task 的關鍵設計決策（供 retry 時參考）
3. 規格缺口（必填）：依 guidelines 守則 1 回報 spec 沒交代、你自行拍板的商業規則，每條寫「所屬 capability／requirement、spec 沒寫什麼、你選了什麼、code 位置」；確認沒有就寫「無」，不可省略
4. 沒把握的註解（必填）：依 guidelines 守則 2 回報你寫了但沒把握的註解，每條寫「檔案:行號、註解原文、沒把握的原因」；確認沒有就寫「無」，不可省略
5. 走法交接（必填）：本次改到畫面時寫進 `{handoffPath}`，這裡只寫檔案位置；沒改畫面寫「無（本次未改畫面）」，不建檔。檔案已存在（前批寫的）就先讀，改寫成涵蓋所有批的整份。內容是給操作流程驗證 agent 的提示，說明怎麼走到每個驗收情況的起點，用你實作時讀過、改過的程式碼推出來：
   - 每個改到的畫面一段：從哪個畫面點進來、用什麼身分、身分在哪裡切
   - 需要特定資料的 scenario 在段落下點名用哪筆；現成資料沒有符合的，寫怎麼在畫面上做出那個狀態；連怎麼做都不知道，寫「不確定」加原因
   - 哪些操作會讓前面做好的狀態消失（身分、登入、已建立的資料都算）
6. 若有順手寫測試，列出測試檔路徑（供 Tester 稽核）
7. 順手觀察（選填）：依 guidelines 規範回報路過看到的無關死碼／可疑處，一行一項；無則省略
```

### Step 5: 派發 Tester Agent

使用 Agent tool 派發 subagent（model: sonnet）。派發前把 `${CLAUDE_SKILL_DIR}/references/tester-conventions.md` 的**絕對路徑**代入 `{testerConventionsPath}`：

```
你是 Tester Agent，角色是**獨立稽核者**——你的價值不是「跑一遍看綠紅」，而是從 spec 獨立推導應驗證的行為，抓出這種情況：Coder 的誤解同時寫進 code 和測試，結果測試全綠，實作其實是錯的。

變更名稱：{changeName}
變更目錄：openspec/changes/{changeName}/

Coder 產出的檔案：
{coderOutputFiles}

Coder 順手寫的測試檔（第 ② 步之前禁止查看）：
{coderTestFiles，無則寫「無」}

開始工作前：
1. 從你 context 的 available-skills 挑選與本專案測試框架／stack 相關的知識型 skill 載入（無合適項就不載）；載入失敗（缺裝／改名）→ 略過該項繼續，不要停
2. Read 測試撰寫守則：{testerConventionsPath}（撰寫規範、測試環境判定、排除規則、執行指令、輸出必含皆在其中；讀不到 → 停下回報）
3. 讀取專案的 CLAUDE.md，找測試慣例：測到哪一層、元件測試用哪個 helper、已知測不到的東西；專案有寫的照專案的，守則檔只管專案沒寫的
4. 讀取變更目錄下的 specs/ 目錄（了解預期行為的 scenarios）
5. 讀取變更目錄下的 design.md（了解設計意圖，使測試貼近實作決策而非僅驗表面行為）
6. 讀取上方列出的 Coder 產出/修改檔案

工作順序（依序執行，順序是為了避免被既有測試的寫法帶著走）：
① 先讀 specs/ 的 scenarios，**獨立列出應驗證行為清單**——此階段**禁止查看任何測試檔**（含 Coder 順手寫的）
② 對照既有測試（含 Coder 本輪所寫）找缺口與錯誤斷言
③ 補寫缺少的測試、修正錯誤的斷言——針對可經真實 import／掛載驗證的 scenario 撰寫，驗不到的列入無法測試清單（不硬產出，降級規則見守則檔排除規則），撰寫與執行依守則檔
④ 依守則檔的執行節奏跑測試（先 scoped 跑到全綠，最後跑一次全部測試）並輸出報告

輸出：
1. 應驗證行為清單（①的產出）
2. 守則檔「輸出必含」列出的各項
```

**出口**：

- 測試通過 → 分批時還有下一批，回 Step 4 派下一批；全部批次跑完 → Step 6
- 測試失敗 → 進入 Retry 迴路（見下方）

### Step 6: Reviewer（Opus subagent）

**Reviewer Skills 預判**

Orchestrator 根據 Coder 修改的檔案清單判斷 Reviewer 除了必載的 `review` 外，是否需要追加 skill，寫入 `{reviewerAdditionalSkills}` 變數：

- 改動觸及 UI 元件的畫面結構或樣式（純邏輯改動不算），或改動純 `.css` / `.scss` / `.sass` / `.less` 檔 → 加 `web-design-guidelines`（覆蓋 UI/UX/a11y 檢查）
- 改動以 UnoCSS 建構 UI（元件畫面結構／樣式用到 UnoCSS utility／shortcut，或改 `uno.config`）→ 加 `antfu-design`（審查 semantic token 使用、雙 light/dark 主題、不用 attributify 等設計慣例遵循；與 `web-design-guidelines` 互補，後者管 a11y／UX，前者管 UnoCSS 設計慣例）
- 改動觸及 Nuxt/Nitro server 端（`server/` API routes／event handlers、`nitro.config`、`routeRules`、server 快取／tasks）→ 加 `nitro`（審查 route rules、快取策略、event handler 慣例）

**Adversarial 模式判斷**

Step 6 **首次**派發 Reviewer 前，下列任一條件成立則設 `{adversarial}` 為 `true`，否則為 `false`：

- 改動觸及安全敏感路徑（清單同 Step 3 的升級判定）
- 改動含資料庫 schema 變更或生產資料遷移

本判定只管首次派發；之後輪次由「Retry 迴路」的升級模式決定。

使用 Agent tool 派發 subagent，派發參數固定為 **`subagent_type: opus-reviewer`**（本 plugin 出貨的 agent：frontmatter 鎖 `model: opus` 與工具白名單——有 Bash 供自跑 `git diff`、無 Write/Edit 的 report-only 門檻；報告第一行自報實際 model 作 runtime 降級偵測）。

prompt 由 orchestrator 依 `srun:review` 的「Reviewer Subagent Prompt 模板」展開（展開規則與 context budget 守則皆見該 skill）——展開後的 prompt 已內含完整 review 標準與輸出格式，subagent 不需另行載入 `srun:review`：

- Scope 代入 `change:{changeName}` 模式；`{adversarial}` 依上方判定代入
- `{reviewerAdditionalSkills}` 依上方預判代入（如 `web-design-guidelines`），由模板的追加 skills 條件區塊指示 subagent 載入
- 「{若 feat 載入：}」條件區塊成立：prompt 末段附上 Coder 產出摘要（檔案清單＋設計決策＋規格缺口）與 Tester 產出摘要（測試檔案＋測試結果）

Subagent 直接輸出最終格式的 review 報告，orchestrator 不再做後續包裝或補檢；只負責呈現給使用者並依判定進入 retry 迴路或下一步。

**Subagent 派發失敗時**：記錄錯誤並停下來問人。派發失敗也不改由主對話自己審。

**出口**：

- PASS 且沒有任何 WARNING／SUGGESTION → 判斷要不要跑 Step 6.5（見其觸發判斷）：要跑 → Step 6.5；不跑 → Step 6.7
- FAIL，或 PASS 但有 WARNING／SUGGESTION → 進入 Retry 迴路（見下方），這關修完後同樣判斷要不要跑 Step 6.5

### Step 6.5: 操作流程驗證（Sonnet subagent，觸及 UI/流程時才跑）

**觸發判斷**：

- 改動觸及使用者流程（畫面結構、頁面／路由、互動）→ 派發
- 純後端、純邏輯、純樣式改動 → 跳過（樣式驗不出流程斷裂，UI/UX 面向由 Step 6 Reviewer 把關）
- **強制例外**：Tester 的「無法測試的模組清單」有模組被頁面使用時，即使是純邏輯改動也**強制派發**，並把受影響頁面清單注入 prompt 做 targeted 驗證，讓 Tester 的警訊有人接（怎麼確認模組被哪些頁面使用，自行判斷）

**先後順序**：本步驟永遠最後才跑，驗的必須是最終 code。

- 測試與 review 每次修復後都會重驗；本步驟要等 Step 6 Reviewer 這關修完（含 WARNING 修復批、SUGGESTION 收尾批與其 targeted re-check 通過）才派發，所以本步驟的 PASS 不會因為之後又改 code 而失效
- 本步驟 FAIL 的修復，要先通過三項檢查與 targeted re-check，才 targeted re-run 本步驟（見 Retry 迴路）

**前置（固定流程）**：

1. orchestrator 自己起一個驗證專用 dev server：
   - 不接手使用者既有的實例：長跑中的舊實例會報假 PASS
   - 埠每個專案固定一個、跨 run 沿用（記在專案 CLAUDE.md 或 openspec 設定）：playwright 持久化設定檔的登入狀態綁 origin，換埠登入就掉
   - 起完以啟動 log 或 lsof 確認實際監聽埠：get-port 類工具在埠被占時會靜默改聽他埠
   - 記下 PID
2. 用 playwright 開入口頁看落點：browser_navigate 到入口路徑、browser_snapshot。落在登入頁即有登入牆。
3. 有登入牆時停下來只說一句「已開好登入頁，請在這個 playwright 視窗登入，好了跟我說」，不索取帳密；使用者回覆後再開一次入口頁確認已進到 app 內部。登入本身是被測流程時才需要測試帳號。
4. 派發 subagent，注入實際 URL。server 與瀏覽器留到 Step 6.7 進場才收，FAIL 修復後的 re-run 直接沿用。

使用 Agent tool 派發 subagent，固定 **`subagent_type: general-purpose` + `model: sonnet`**。載入 `srun:verify-flow` skill，由其 subagent prompt 模板驅動。orchestrator 注入：

- 變更名稱
- app URL／啟動方式
- 驗收依據：`openspec/changes/{changeName}/specs/`
- 已知的重點元件／位置
- 走法交接：Coder 回報的所有交接檔位置；都是「無」就不給
- 必要時的已驗證入口或測試帳密

判準、輸出格式、preflight、登入牆與反 rabbit-hole 規則皆見 `verify-flow` skill，此處不重複。

**verdict 分支**：

- **PASS** → 進 Step 6.7
- **FAIL**（流程斷 / console error / spec 明文元件或位置不成立；判 FAIL 前 agent 已依 `verify-flow` 做過重現確認）→ 進 Retry 迴路回 Coder 修（見下方）
- **BLOCKED**（不計 retry）：
  - **工具未就緒**（playwright MCP server 沒起 / 瀏覽器工具載不到）→ **跳過本步、退回純人工驗收**：報告開頭那行寫「操作流程驗證沒跑（瀏覽器工具沒就緒）」，「要你親手驗的」寫「整個流程沒有自動點過，請從頭點一遍」。**不當 FAIL**（別打回 Coder）、**不靜默放行**，不阻斷交付
  - **環境**（dev server / seed data / 連不上）或 **登入牆**（缺測試帳號 / 第三方 OAuth / SSO / CAPTCHA / 2FA / 魔術連結）→ 停下來問人

不論 verdict，驗證報告的下列三段都不打回 Coder、不計 retry，原樣帶進 Step 7 報告的「要你親手驗的」：

- **flaky**：一次性錯誤、重現不出
- **待人確認**：算不算壞判斷不了
- **工具做不到的**：工具在，但做不到 spec 要求的操作；其他情境照常判定，報告開頭那行補「（N 個情境工具做不到）」

**Subagent 派發失敗時**：判為 BLOCKED（工具未就緒），跳過本步、退回人工驗收。派發失敗也不改由主對話自己驗。

### Step 6.7: 規格缺口回寫（orchestrator 自做，不派 agent）

**進場先收驗證環境**：用 Step 6.5 記下的 PID 關掉自己起的 dev server（不比對程序名），刪除 playwright 寫在專案根的 `.playwright-mcp/`；此後沒有步驟再驗畫面。

**規格缺口回寫**：彙整本次 run 所有批次 Coder 回報的「規格缺口」與 Reviewer 報告「規格缺口」段的條目（同一情境只留一份），寫進本 change 的 delta spec。

- 缺口為零 → 跳過，報告不列這段
- 路徑與格式從後端 CLI 讀（openspec 與 spectra 同名：`<cli> instructions specs --change {changeName} --json`），不自己猜；寫完跑 `<cli> validate {changeName}`
- 只寫 delta spec，不動主規格：合併由驗收通過後的收尾指令照舊處理

### Step 7: 報告結果

**勾選前實測**：報告前，逐條實測 tasks.md 與 design.md 裡的判準，對照後才勾。

- 要實測的判準：
  - 量化判準（條目數、指標數）
  - 「全綠」「無 diff」類判準
  - Step 3 對應到 gate、由 orchestrator 代勾的項目
- 實測與判準對不上時：
  - 判準本身寫錯，且正確值唯一明確 → 對正 artifact 後勾
  - 判準沒錯，實作未達 → 回對應 gate 的 retry 迴路
  - 落差會改變驗收語意 → 問人
- 實作中途調整作法、判準沒跟著改的情況，也由這裡攔截

顯示完成報告（格式見「輸出格式」）。報告只放要人看或要人決定的事：開頭一行講結果，其餘各段有內容才出現，沒有就整段省略、不寫「無」。各段的來源：

- **AI 自行裁決**：AI 沒照原路修、自己下的判斷
  - 測試異議受理，改的是測試不是程式（附依據來源路徑）
  - review 異議經仲裁撤回的 finding
  - Coder 回報不修的 SUGGESTION 與理由
  - Tester 缺套件、沒寫測試的模組（寫出套件名，問要不要裝）
  - 上方勾選前實測時，判準寫錯、自行對正 artifact 的項目
- **規格缺口**：Step 6.7 寫進 delta spec 的條目
- **要你親手驗的**：
  - Step 6.5 帶來的 flaky、待人確認、工具做不到的；工具未就緒時的整段退回
  - Step 3 對應不到任何 gate 的驗證型 task
- **沒把握的註解**：各批、各修復輪 Coder 回報的條目；後來修復時已刪掉的不列
- **順手看到的**：Coder 回報的順手觀察，原樣列入。它是情報不是待辦，不觸發任何 retry 或派發

一般修復輪的過程（哪關擋下、怎麼修好）不列，只在開頭那行寫退回修過幾次：跑的過程中各關報告已顯示過，retro 也記了。

**retro 記錄**：載入 `srun:retro` skill，依其記錄模式記錄本次 run。

- 記錄內容：防錯規則開關（`guards` 七欄，分別是起跑 model 與理由、首派 Reviewer 的 adversarial、升級模式開在哪關第幾輪與下輪過沒過、targeted re-check 次數與 FAIL 數、達上限時人的裁決、Coder／Reviewer 自報的 model id）、事件與統計，append 進全域收件匣
- 開關取值回頭看本 run 的實際派發參數與 gate 結果，不憑記憶
- `usage` 欄跑該 skill 指定的統計腳本取得（傳 Step 1 宣告的時間作 `--since`）
- 報告的「retro」節照該 skill「從 feat／fix 呼叫」的回顯規則：只有歸檔提醒或記錄失敗時出現。開關表、事件表、條目格式、回顯與提醒以該 skill 為單一來源，此處不複製
- append 失敗不阻斷報告

報告輸出後，**主動刪除**本次 change 在 `.claude/debug/` 的殘留檔（驗證截圖、除錯檔、走法交接檔）：檔案價值僅在執行中；`.claude/` 應由專案 gitignore 蓋掉，不進版控。

**跳驗收選項**：刪完殘留檔，用 AskUserQuestion 問驗收結果。人還沒實際驗，三個選項都不標建議：

- **驗收通過，跑收尾** → 照 SessionStart 交界圖「驗收通過」那行收尾
- **有地方要改**（人寫哪裡不對）→ 照交界圖「驗收發現問題」那行處理。規格缺口不接受也選這個：走 `/srun:fix` 驗收修正改程式，並從 delta spec 刪掉那條
- **還沒驗完，晚點再說** → 不做任何事，等人回來說

---

## Retry 迴路

通用規格（一輪定義、不計輪、修復派發附帶物、交回結果前的三項檢查、升級模式）見 `${CLAUDE_SKILL_DIR}/references/retry-loop.md`：任一 gate 首次失敗進入迴路時先讀。

### 修復派發 prompt 規則

- **修復派發 prompt**：spec alignment 類 finding 已依 `review` 規範附上被違反的 spec 段落原文——orchestrator **全文轉遞**，修復 agent 不必重讀 spec 檔
- **派給 Coder 的修復 prompt 一律載明**：
  - 先載入 `srun:guidelines` 行為守則再動手（同首派）
  - 不得修改測試檔（修復階段測試修改一律由 Tester 派發）
  - 判斷失敗屬測試問題 → 依「測試異議」回報並引驗收依據原文，不要自行改斷言
- **派給 Coder 的修復 prompt 附走法交接**：前一輪輸出摘要附上所有交接檔位置；回報必填一行「交接變動：無」或「交接變動：已重寫 {位置}」。修復改到走到起點的路（入口、身分、要用的資料）才算有變，有變就整份重寫該檔
- **升級模式開啟後**，Opus Reviewer 重派一律帶 `{adversarial}=true`；Reviewer 自身固定 Opus，無升級問題

### 各 gate 失敗誰修、重驗什麼

| Gate 失敗 | 誰修 | 修完重驗什麼 |
|----------|------|-------------|
| 測試 | Coder（判斷屬測試問題 → 提出測試異議） | 三項檢查全綠即修完，**不重派 Tester**——修復後防的是機械回歸，跑套件即可；Tester 的獨立價值在首輪設計測試 |
| Review FAIL（有 CRITICAL） | 依歸屬：實作代碼 → Coder、測試代碼 → Tester；嚴重安全問題 → 直接停下來問人（認為 finding 不成立 → 提出 review 異議） | 重派 Opus Reviewer |
| Review PASS with WARNING | WARNING 視為需修復；依歸屬修，**同一歸屬的所有 WARNING 合併為一個修復任務一次改完**（SUGGESTION 併入方式見下方處置；認為 finding 不成立 → 提出 review 異議） | Sonnet targeted re-check（執行 `review` 的 Targeted Check 模式：只審修復 diff、驗證修復正確且未引入新問題；**不升級為 Opus 完整 review**） |
| 操作流程驗證 FAIL | Coder（判 FAIL 前 agent 已依 `verify-flow` 做過重現確認） | 依序：三項檢查 → Sonnet targeted re-check（只審修復 diff）→ 最後 **verify-flow targeted re-run**（只重走受影響流程） |

歸屬 `spec`（規格 artifact 內容本身的問題，見 `review` 的歸屬定義）的 finding，FAIL 與 WARNING 同一路由：**決策級**（需推翻 design 決策或改變規格語意）→ 直接停下來問人，不進 Coder retry；**機械級**（殘留、漏掃、跨載體同步遺漏）→ 派 Coder 修 artifact 檔案，照常計輪。

**SUGGESTION 處置**：只在 Reviewer **最終報告**處理一次。有 WARNING 修復批就併入同批，沒有（PASS 乾淨）則單獨派一次收尾批；同樣走 targeted re-check，**不計輪**、不影響 verdict。Coder 對會擴 scope 或推翻既定取捨的項目回報不修並附理由，其餘修完。

**這關修完後回哪一步**：

- 測試 → 分批時還有下一批，回 Step 4 派下一批；全部批次跑完 → Step 6
- Review（FAIL、WARNING、SUGGESTION 全部修完）→ 判斷要不要跑 Step 6.5：要跑 → Step 6.5；不跑 → Step 6.7
- 操作流程驗證 → targeted re-run PASS 後進 Step 6.7

### 測試異議

測試 FAIL 進迴路前，orchestrator 先以失敗訊息對照驗收依據原文：

- 斷言的期望值與 spec／design／tasks 原文直接衝突 → 直接改派 Tester 修測試，並在報告記明依據（來源路徑），不派 Coder
- 看不出衝突，或衝突在程式行為裡而不在文字上 → 派 Coder 修，Coder 仍可提出測試異議

Coder 判斷測試失敗原因是「測試與驗收依據不符」時（不論該測試的原作者是誰），可提出測試異議：**必須引用驗收依據原文**（spec scenario／design 段落，含來源路徑）並指出斷言不符之處，**引不出原文不受理**，乖乖修 code。受理後主對話**改派 Tester 修測試**——修復階段的測試檔修改一律歸 Tester；Tester 可反駁，同樣須引依據原文。異議輪照計輪。

### review 異議

修復 agent（Coder 或 Tester）判斷被指派修復的 review finding 不成立時（Reviewer 誤讀程式碼、finding 與驗收依據或專案慣例衝突、建議修法會違反 spec），可提出 review 異議：**必須引用依據原文**（spec 段落／CLAUDE.md 條文，含來源路徑；或指出誤讀處的檔案:行號與實際行為），**引不出依據不受理**，乖乖修。CRITICAL 與 WARNING 的修復派發皆適用。

受理後主對話重派 **Opus Reviewer 仲裁**——targeted 派發：只裁被提出異議的 finding，prompt 附原 finding 與異議全文，要求逐點回應異議依據後判「維持／撤回」；不重做完整 review、不計 Reviewer retry counter（性質同 targeted re-check 的驗證派發）。

- **撤回** → 該 finding 自修復清單移除；該輪所有待修項皆被撤回 → 該輪視為通過，不需 re-check
- **維持**而修復 agent 仍有異議 → 停下來問人（人是最終仲裁）

異議輪照計輪，防止以連續異議拖延修復。

---

## 輸出格式

### Phase 2 完成

```
## Phase 2 完成：{changeName}
改了 {N} 個檔案，{M} 個測試全過，Reviewer 通過，操作流程驗證{結果}{；中間退回修過 K 次}。

### AI 自行裁決（驗收時確認你同不同意）
- {做了什麼判斷、依據或理由，一條一行}

### 規格缺口（AI 替你決定的規則；不接受的告訴我，我改程式並從 delta spec 刪掉）
| # | requirement | spec 沒寫什麼 | AI 選了什麼 | 位置 |
|---|-------------|---------------|-------------|------|

### 要你親手驗的
- {驗什麼；為什麼自動檢查做不到}

### 沒把握的註解（留不留由你決定；不要的告訴我，我刪掉）
- {檔案:行號}：`{註解原文}`
  沒把握的原因：{原因}

### 順手看到的（跟這次無關，要不要處理你決定）
- {位置：看到什麼}

### retro
{依 `srun:retro`「從 feat／fix 呼叫」的回顯規則}
```

- 開頭那行的 `{結果}`：`通過`｜`通過（N 個情境工具做不到）`｜`不需要（這次沒改到畫面）`｜`沒跑（瀏覽器工具沒就緒）`
- `；中間退回修過 K 次`：K ＝本 run 的修復派發次數，零次整句省略
- 開頭以外各段有內容才出現，沒有就整段省略

### 遇到阻塞

依 `${CLAUDE_SKILL_DIR}/references/blocked-report.md` 的模板：先輸出 debug 檔 `.claude/debug/{changeName}-{timestamp}.md`（生命週期見 Step 2 lazy cleanup 與 Step 7 主動刪），再向使用者顯示阻塞摘要。

---

## Guardrails

- Agent tool 派發的 `description` 一律以角色開頭（Coder／Tester／Reviewer／驗證／re-check），修復派發含「修復」或「修正」——retro 的用時統計靠它分辨每次派發是誰、首派還是修復
- 每個 agent 的 prompt 只傳變更名稱和目錄，讓 agent 自行讀取 artifacts；不在 prompt 中貼入檔案內容
- 獨立的修復任務可平行派發，**前提是修復檔案集不相交**（如 Coder 與 Tester 各修不同檔案的 WARNING）；檔案相交或無法確定 → 串行。平行派發時，在各 agent 的 prompt 註明另有哪個 agent 同時在改哪些檔
- Coder / Tester 派發本身失敗或中途中斷 → 以 `git status` 對照 tasks.md checkbox **對帳實際完成度**後再重派（磁碟優先，不憑對話記憶推測進度）
