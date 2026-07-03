---
name: code-fix
description: Tier 2 輕量 Pipeline — 決策已在對話收斂、且不需建立新的 OpenSpec artifact 的小改動時使用（跨檔案 bug 修復、小型 UI 調整、composable 微調、進行中 change 的驗收修正；檔案數僅為輔助訊號）。spec-first：派發前先做 Spec 影響判斷、有影響先更新規格，再派發 Coder+Tester→註解整理。需要 spec 記錄（新增 API/元件、行為值得規格化）、決策分支多或需拆批改用 code-feat；單行/純樣式微調直接在對話改即可。
---

Tier 2 輕量版 Agent Pipeline。定位一句話：**「對話定案、乾淨執行、快速人工驗證」的執行品質層**——品質高於主對話直改（fresh-context Coder 載入行為守則＋Tester 驗證＋branch 隔離），重量低於 feat 驗證鏈（無 Reviewer 迴路、無操作流程驗證）。「設計我來、執行你來、驗收我來」分工的載體。

與 `/code:feat`（Tier 3）的差異：
- 不建立新的變更 artifact — 需求從對話定案取得（場景 (ii) 可回寫**既有** change artifact，見下方）
- 只派發 Coder + Tester（不跑 Reviewer）
- Spec 同步走「派發前 Spec 影響判斷＋commit 前輕量複核」（非完整 change 歸檔流程，如 /opsx:verify / sync / archive）

**Input**: 對話中已描述問題或需求。未描述清楚時，先釐清再啟動。

---

## 適用判斷

**路由判準**（檔案數僅為輔助訊號，不是門檻）：

| 判準 | 走向 |
|------|------|
| 決策已在對話收斂 ＋ 不需建立**新的** OpenSpec artifact | **Tier 2（本 skill）** |
| 需要 spec 記錄（新增 API/元件、行為值得規格化）、決策分支多到需完整收斂流程、或變更需拆批 | Tier 3（`/code:feat`） |
| 瑣碎微調（單行修正、純樣式、文案） | Tier 1（主對話直改） |

**微決策路徑**：需求帶著 1-2 個未定小決策時，不必升 Tier 3——在對話中把這幾題收斂定案後即可派發。判斷軸是「決策是否已收斂」，不是「有沒有做過決策」。

**兩種進入場景**：

1. **場景 (i) 獨立小功能／改動**：主對話討論定案後派發。
2. **場景 (ii) 進行中 change 的驗收修正**：Tier 3 人工驗收發現的問題，不大到重跑 `/code:feat`、但有決策且要執行品質。此場景不讀取 Tier 3 的任何執行狀態——retry counter 不復活、model 棘輪歸零重新起算（Coder 從 sonnet 重起，升級條件照常適用）。

---

## 專案配置

### Agent Knowledge Skills

| Agent | Skills（必載） | 可選 Skills | 用途 |
|-------|---------------|------------|------|
| Coder | `code-guidelines`, `vue`, `vue-best-practices`, `nuxt`, `antfu` | 由 orchestrator 根據問題內容預判並寫入 prompt（如 `pinia`, `unocss`, `vite`, `vue-router-best-practices`, `vueuse-functions`, `pnpm`, `turborepo`） | `code-guidelines` 為行為守則（最小可行、外科手術式改動、自主判斷邊界）；其餘為 Vue/Nuxt 開發慣例、程式碼風格、元件拆分守則（與 `/code:feat` 同步） |
| Tester | `vitest`, `antfu`, `vue-testing-best-practices` | — | 測試框架用法、Vue 元件測試慣例 |

### Model 策略

| Agent | Model |
|-------|-------|
| Coder | sonnet（預設）/ opus |
| Tester | sonnet |
| 安全 review（條件性，見 Step 5.5） | opus（adversarial） |
| 註解整理 | sonnet |

Coder 預設 sonnet。Tier 2 為決策已收斂的小改動，故 `/code:feat` 的「架構變更」「設計決策密集」升級條件在此不適用；僅保留下列兩條升級規則：

- **首次派發**：改動觸及安全敏感路徑（auth、payment、API key 處理、session 管理）→ `{coderModel}` 設為 `opus`，並**聯動設 `{securityReview}=true`**（觸發 Step 5.5 安全 review——同一訊號同款待遇）
- **Retry 動態升級（統一規則，與 Tier 3 同款）**：同一迴路 counter ≥ 2 起（即第 2 輪起），該迴路的**修復派發**升 `opus`（後續修復皆用 opus，不再降回；綁派發不綁角色）。連 2 輪未收斂代表非表層瑕疵；升 Opus 那輪解除「免重讀」限制（解禁非強制）

判定保守。一般小改動維持 sonnet。

---

## 流程

### Step 1: 整理需求與場景判定

從對話中擷取：

1. **問題描述**：什麼壞了 / 要改什麼
2. **預期行為**：修好後應該怎樣
3. **可能影響的檔案**：根據問題描述搜尋定位
4. **場景判定**：獨立小功能／改動（場景 i），或進行中 change 的驗收修正（場景 ii——記下 change 名稱，供 Step 3 讀取該 change 的 artifacts）

宣告：「Tier 2 code:fix：{問題摘要}」

**Coder Skills 預判**

Orchestrator 根據問題描述和相關檔案判斷 Coder 除了必載的 `vue`, `vue-best-practices`, `nuxt`, `antfu` 外，還需要哪些額外 skills，寫入 `{additionalSkills}` 變數（觸發規則與 `/code:feat` 一致，避免兩個 pipeline 走出不同風格）：
- 問題涉及 store / state → 加 `pinia`
- 問題涉及 CSS utility / atomic → 加 `unocss`
- 問題涉及 build config / plugin → 加 `vite`
- 問題涉及路由 / middleware / navigation guard / route params → 加 `vue-router-best-practices`
- 問題涉及 DOM 事件 / 瀏覽器 API / 常見 composable 場景（local storage、media query、resize、clipboard 等）→ 加 `vueuse-functions`
- 專案使用 pnpm（`package.json` 含 `"packageManager": "pnpm@..."` 或根目錄存在 `pnpm-lock.yaml`）且問題涉及依賴 / workspace / catalog / patch → 加 `pnpm`
- 專案為 monorepo（根目錄 `Glob turbo.json` 命中）且問題跨 package → 加 `turborepo`

### Step 2: 建立工作分支

確認當前 git 分支狀態：

- 若在 `main`、`develop` 等主要分支上 → `git checkout -b fix-<描述>`
- 若已在功能分支上 → 跳過（場景 ii 通常已在該 change 的功能分支上）

### Step 3: Spec 影響判斷（spec-first，派發前）

派發前先判斷本次改動是否影響規格——讓 Coder 拿到**權威版驗收依據**（spec 原文而非對話轉述），也讓 Tester 的獨立稽核有 ground truth：

```
1. 根據問題描述與定位到的檔案，比對相關規格：
   - openspec/specs/    （OpenSpec 主規格庫）
   - 場景 (ii)：openspec/changes/<name>/ 下的 specs/ 與 design.md
   - 專案 CLAUDE.md 中定義的其他設計文件位置
2. 判斷：
   ├─ 無影響（純實作問題：行為不變的 bug 修復、實作瑕疵）→ 直接進 Step 4 派發
   ├─ 場景 (i) 有影響 → 先更新 openspec/specs/ 對應段落，再派發
   └─ 場景 (ii) 影響在 spec/design 層 → 先回寫 change artifact
      （與需求變更「先回寫 artifact 再續跑」同一原則），再派發
3. 更新後的 spec 段落作為驗收依據注入 Coder 派發 prompt（見 Step 4）
```

判斷中若發現其實需要**新的** spec（新增 API/元件、行為值得規格化）→ 這不是 Tier 2 該做的事，停下建議升 Tier 3。

Spec 改動先留在工作區，不單獨 commit——最後與 code 同一個 commit 交付（SDD 不變量）。

### Step 4: 派發 Coder Agent

依「Model 策略」判定 `{coderModel}`（首次派發預設 sonnet，安全敏感路徑升 opus）。使用 Task tool 派發 subagent（model: {coderModel}）。模板展開規則：`{變數}` 以實際值替換；`{若...：}` 條件區塊成立時留內文、不成立整段刪除：

```
你是 Coder Agent。

開始工作前：
1. 用 Skill tool 載入以下 skills：code-guidelines, vue, vue-best-practices, nuxt, antfu{additionalSkills}
   （`code-guidelines` 是寫 code 的行為守則，其餘為知識型；務必先讀 `code-guidelines` 再動手）
   任一必載 skill 載入失敗（缺裝／改名）→ 停下回報，不要在缺慣例約束的情況下繼續寫
2. 讀取專案的 CLAUDE.md 了解專案慣例

注意：若修復過程中發現需要用到上方未列出的 skill，可自行載入補充。

問題描述：
{從對話擷取的問題描述}

預期行為：
{修復後的預期結果}

{若 Step 3 有更新 spec：}
驗收依據（spec 原文，權威版——實作以此為準）：
{更新後的 spec 段落，含來源路徑}

可能相關的檔案：
{列出定位到的檔案路徑}

請修復此問題：
- 遵循專案設計系統與慣例
- 善用既有的 composables 和 utils
- 只修改必要的部分，不做額外重構

完成後依序執行（錯誤自行修復，不計 retry）：
1. 專案 lint script（優先用專案既有 script，如 `pnpm lint --fix`；無對應 script 才 fallback 到 `pnpm exec eslint --fix`。依專案 package manager 調整指令，不要用裸 `npx`）
2. typecheck：優先跑專案自己的 `typecheck` script；Nuxt 專案用 `pnpm exec nuxi typecheck`（裸跑 vue-tsc 在未 prepare 的 Nuxt 專案會炸）

輸出：
1. 修改的檔案路徑與變更摘要
2. 修復邏輯的簡要說明（供 retry 時作為上下文參考）
```

### Step 5: 派發 Tester Agent

使用 Task tool 派發 subagent（model: sonnet）：

```
你是 Tester Agent。

開始工作前：
1. 用 Skill tool 載入以下 skills：vitest, antfu, vue-testing-best-practices
   任一必載 skill 載入失敗（缺裝／改名）→ 停下回報，不要在缺慣例約束的情況下繼續寫
2. 讀取 Coder 修改的檔案：
   {Coder 回報的檔案路徑列表}

預期行為：
{修復後的預期結果}

{若 Step 3 有更新 spec：}
驗收依據（spec 原文，權威版——測試斷言以此為準）：
{更新後的 spec 段落，含來源路徑}

撰寫測試：
- 測試檔放在與源碼同目錄（foo.test.ts）
- 使用 describe/it API 結構
- 針對修復的行為撰寫測試，確保 bug 不會再現
- 純邏輯函式應抽出為獨立模組，測試 import 實際模組（不複製邏輯）

排除規則（不要撰寫以下測試）：
- TypeScript 型別/介面欄位存在性測試（typecheck gate 已保證型別正確性）

Nuxt composable 的測試策略（三層，依序）：
1. 純邏輯抽為獨立模組的規則不變（結構層優先）——能測 import 實際模組的先這樣測
2. 殘餘的 Nuxt runtime 依賴：讀 package.json 偵測 `@nuxt/test-utils` 是否已裝——已裝即用它直接測；只在需要重環境的測試檔標 `@vitest-environment nuxt`，純邏輯測試照走輕環境。永不主動安裝依賴
3. 未裝才跳過該模組的單元測試（不要複製邏輯自測），列入「無法測試的模組清單」輸出

完成後執行測試：優先跑專案 test script（如 `pnpm test`，依專案 package manager 調整）；需要逐項失敗資訊時用 `pnpm exec vitest run --reporter=verbose`。不要用裸 `npx`。

輸出：
1. 建立的測試檔案路徑
2. 測試結果（通過/失敗）
3. 若有失敗，列出每個失敗的測試名稱和錯誤原因
4. 無法測試的模組清單（列出模組名稱與跳過原因，如「useWeatherApi — Nuxt composable，無法在單元測試中 import」）
```

**測試失敗時**：進入 Retry 迴路（見下方）。

**無法測試清單的消費者（Tier 2 報告行）**：Tester 回報的「無法測試的模組清單」非空、且模組被頁面使用時（grep composable 名稱於 pages/components，一條指令），把**受影響頁面清單寫進完成報告的「人工確認提示」段**（例：「composable `useXxx` 無法被單元測試覆蓋，被頁面 A、B、C 使用，建議確認時順手檢查」）。Tier 2 **不派** verify-flow——洞的本質是「人工確認時不知道爆炸半徑」，給人 grep 清單即補上資訊差，要看多細由人決定。

### Step 5.5: 安全 review（`{securityReview}=true` 時才跑，adversarial Opus）

改動觸及安全敏感路徑時（與 Coder 升 Opus 同一訊號），Tester 通過後、註解整理之前，自動補派一次 **adversarial Opus review**——與 Tier 3 同款訊號同款待遇。安全殺傷力與改動行數無關（兩行 session 邏輯的爆炸半徑可大於二十檔 UI 重構）；分級管的是流程重量，不該分掉安全底線。

- 載入 `code-review` skill 取得規範，依其 Reviewer Subagent Prompt 模板派發 subagent（`subagent_type: opus-reviewer`——plugin agent 已鎖 model 與工具白名單），`{adversarial}=true`、scope 為本次修改檔案的 diff
- **FAIL 的修復走完整靜態關卡**：Coder 修 → settle 前自跑三件套（lint + typecheck + test）→ Sonnet targeted re-check（只審修復 diff）；小迴路最多 3 輪，仍 FAIL → 停下來問人。嚴重安全問題 → 直接停下來問人
- Subagent 派發失敗 → 停下來問人，不退化為主對話自審（獨立審查不變量）

### Step 6: 註解整理（Sonnet subagent）

所有 gate settle 後（Coder/Tester，含條件性的 Step 5.5 安全 review）、Spec 輕量複核前，派發一次註解整理 Agent 清除本次修復累積的過時／思考流程／冗餘註解。

- 載入 `code-comment` skill 取得整理規範與輸出格式
- 使用 Task tool 派發 subagent，固定 **`subagent_type: general-purpose` + `model: sonnet`**
- scope 為「本次修改的檔案清單」（Coder 產出 + Tester 測試檔），由 orchestrator 注入 prompt 的 `{changedFiles}`
- 整理 Agent 依守則**直接套用 Edit**並自跑 lint --fix（指令依專案偵測，優先 `pnpm lint --fix`，不寫死 `npx`；不可刪除功能型指令註解，如 `eslint-disable`、`@ts-expect-error`、`istanbul ignore`、`v-html` 安全註記）
- 整理完成後 orchestrator **重跑測試**（專案 test script，如 `pnpm test`）作為安全網；失敗回整理 Agent 修正（最多 1 輪），仍失敗 → 停下來問人

### Step 7: Spec 輕量複核（commit 前）

Step 3 已做過 spec-first 影響判斷；此處只做一行輕量複核，防**實作過程中的範圍外溢**（Coder 實際改動超出派發宣告範圍時，可能觸及 Step 3 未評估的規格）：

- 比對 Coder 實際修改的檔案清單與 Step 3 的判斷範圍：一致 → 在完成摘要標記「Spec 已同步（前移）」或「Spec 無影響」；超出 → 對超出部分補跑一次 Step 3 的影響判斷，有影響即補更新 spec

**不執行 commit。** Commit 時機由人工決定（通常在 change 歸檔時一併處理）；Spec 改動與 code 同一個 commit 交付。

### Step 8: 報告結果

顯示完成摘要（含註解整理與 Spec 同步結果），提示人工確認修復結果。

---

## Retry 迴路

### 測試失敗 → Coder 修復

1. 將以下資訊傳給修復 Coder：
   - 失敗的測試名稱和錯誤訊息
   - **前一輪 Coder 的輸出摘要**（修改的檔案清單 + 修復邏輯說明）
   - 明確的修復指示
2. Coder prompt 須明確指示：**不需重讀 CLAUDE.md 與周邊檔案**，只讀前輪輸出摘要、失敗報告、要修改的檔案（**升 Opus 那輪解除此限制**——連兩輪修不好大概率是理解問題，Opus 自行判斷要不要重讀 spec 依據與周邊檔）
3. **counter ≥ 2 起（第 2 輪起）修復派發升 `opus`**（統一規則，見 Model 策略），後續修復派發皆用 opus
4. 修復 Coder settle 前**自跑三件套**：lint + typecheck + 專案 test script；lint／型別紅燈就地修（不計 retry）；三件套全綠即 settle，**不重派 Tester**（修復後防的是機械回歸，跑套件即可偵測）
5. 最多 3 輪，修不好 → 停下來問人

### Retry 計數（統一判準，與 Tier 3 同款）

- **計一圈**＝品質失敗回到主對話、需要派 agent 去修
- **不計**：ESLint / typecheck 自修、修復 Coder 三件套的就地修（未回主對話）
- 測試迴路最多 3 輪；安全 review 的 targeted re-check 小迴路獨立計數、上限 3 輪
- 3 輪修不好 → 停下來問人（問題可能較嚴重或 AI 忽略關鍵細節）

---

## 輸出格式

### 完成

```
## Tier 2 完成：{問題摘要}

### Agent Pipeline 結果
- Coder: ✓ 完成（N 個檔案）
- Tester: ✓ 通過（M 個測試）
- 安全 review: ✓ PASS（僅 {securityReview}=true 時列出）
- 註解整理: ✓ 清除 X 處 / 改寫 Y 處（測試重跑通過）

### Pipeline 統計
- Coder 派發次數：{coderCalls}（含 retry）
- Tester 派發次數：{testerCalls}（含 retry）

### Retry 記錄
（若有 retry，列出每輪的問題與修復摘要）

### 人工確認提示（無法自動驗證的部分）
（Tester 的無法測試清單非空且被頁面使用時列出爆炸半徑，例：「composable `useXxx` 無法被單元測試覆蓋，被頁面 A、B、C 使用，建議確認時順手檢查」；無則「無」）

### Spec 同步（spec-first）
- 場景：{(i) 獨立改動 | (ii) 驗收修正：{changeName}}
- {Step 3 更新的 spec 段落列表} 或「無影響（純實作問題）」
- 輕量複核：{範圍一致 | 超出範圍，已補更新 {spec}}

### 下一步
請人工確認修復結果。Commit 時機由人工決定（Spec 改動與 code 同 commit）。
```

### 遇到阻塞

Orchestrator 在宣告阻塞前，輸出 debug 檔案 `.claude/debug/fix-{timestamp}.md`（不放專案根目錄——檔案含完整 diff，`.claude/` 應由專案 gitignore 蓋掉）：

```markdown
## Pipeline 暫停：{問題摘要}

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
## Pipeline 暫停：{問題摘要}

### 問題
{問題描述}

### 已完成
- Coder: ✓
- Tester: ✗ 第 3 輪仍失敗

### Pipeline 統計
- Coder 派發次數：{coderCalls}
- Tester 派發次數：{testerCalls}

### Debug 檔案
已輸出至 .claude/debug/fix-{timestamp}.md

### 選項
1. 人工介入修復
2. 重新描述問題後重跑
3. 升級為 Tier 3（建立 OpenSpec change，走 /code:feat）
```

---

## Guardrails

- Coder prompt 直接描述問題（含 Step 3 更新後的 spec 驗收依據），不要求 agent 自讀完整變更 artifact
- Coder（含 retry 派發）一律先載入 `code-guidelines` 行為守則再動手——從生成端約束過度設計與越界改動
- 不在 prompt 中貼入檔案內容，讓 agent 自行讀取
- Coder 的輸出（檔案清單 + 修復邏輯）由 orchestrator 保留，用於傳遞給 Tester 和 retry
- Retry 迴路中，附帶前一輪的輸出摘要，避免 context 斷裂導致重複犯錯
- 任何修復完成後，修復 Coder settle 前一律自跑三件套（lint + typecheck + test）
- 3 輪上限後必須停下來問人，不可繼續嘗試
- 安全敏感路徑不因 Tier 2 輕量而降低把關：升 Opus 與 adversarial review 聯動觸發（同一訊號同款待遇）
- 註解整理在所有 gate settle 後（含條件性安全 review）執行，只動註解不動 code 邏輯，整理後必重跑測試作為安全網
- Pipeline 完成後不自動 commit，等人工確認
- Spec 影響判斷前移至派發前（spec-first）不可跳過；commit 前輕量複核防範圍外溢 — SDD 核心原則：spec 先行，Code 和 Spec 同一個 commit
