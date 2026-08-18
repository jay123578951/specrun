---
name: fix
argument-hint: "[問題描述]"
description: Tier 2 輕量 Pipeline — 決策已在對話收斂、且不需建立新的 OpenSpec artifact 的小改動時使用（跨檔案 bug 修復、小型 UI 調整、小型模組微調、進行中 change 的驗收修正；檔案數僅為輔助訊號）。需要 spec 記錄（新增 API/元件、行為值得規格化）、決策分支多或需拆批改用 feat；單行/純樣式微調直接在對話改即可。
---

Tier 2 輕量版 Agent Pipeline。定位一句話：**「對話定案、乾淨執行、快速人工驗證」的執行品質層**，「設計我來、執行你來、驗收我來」分工的載體。

與 `/srun:feat`（Tier 3）的差異：
- 不建立新的變更 artifact — 需求從對話定案取得（場景 (ii) 可回寫**既有** change artifact，見下方）
- 只派發 Coder（測試由 Coder 自寫，不派獨立 Tester 與 Reviewer）
- Spec 同步走「派發前 Spec 影響判斷＋commit 前輕量複核」（非完整 change 歸檔流程，如 /opsx:sync / archive）

**Input**: 對話中已描述問題或需求。未描述清楚時，先釐清再啟動。

---

## 適用判斷

**路由判準**（檔案數僅為輔助訊號，不是門檻）：

| 判準 | 走向 |
|------|------|
| 決策已在對話收斂 ＋ 不需建立**新的** OpenSpec artifact | **Tier 2（本 skill）** |
| 需要 spec 記錄（新增 API/元件、行為值得規格化）、決策分支多到需完整收斂流程、或變更需拆批 | Tier 3（`/srun:feat`） |
| 瑣碎微調（單行修正、純樣式、文案） | Tier 1（主對話直改） |

**微決策路徑**：需求帶著 1-2 個未定小決策時，不必升 Tier 3——在對話中把這幾題收斂定案後即可派發。判斷軸是「決策是否已收斂」，不是「有沒有做過決策」。

**兩種進入場景**：

1. **場景 (i) 獨立小功能／改動**：主對話討論定案後派發。
2. **場景 (ii) 進行中 change 的驗收修正**：Tier 3 人工驗收發現的問題，不大到重跑 `/srun:feat`、但有決策且要執行品質。此場景當作全新的 Tier 2 run 起跑——不繼承 Tier 3 的 retry 次數或已升級的 model（Coder 從 sonnet 重起，升級條件照常適用）。

---

## 專案配置

### Agent Knowledge Skills

與 `/srun:feat` 同步：orchestrator 不預判知識型 skill 清單，派發 prompt 只強制 `srun:guidelines`，其餘由 Coder 自行從 available-skills 挑選與 stack、本次改動相關的知識型 skill 載入（Coder 兼寫測試，測試框架類 skill 一併自取）。

| Agent | Skills（必載） | 可選 Skills | 用途 |
|-------|---------------|------------|------|
| Coder | `srun:guidelines` | 自行從 available-skills 挑選 | `guidelines` 為行為守則（最小可行、外科手術式改動、自主判斷邊界；stack 無關恆載）；知識型 skill（開發慣例、程式碼風格、元件拆分守則、測試框架用法）由 Coder 自取 |

### Model 策略

| Agent | Model |
|-------|-------|
| Coder | sonnet（預設）/ opus |
| 安全 review（條件性，見 Step 5） | opus（adversarial） |
| 註解整理 | sonnet |

Coder 預設 sonnet。Tier 2 為決策已收斂的小改動，故 `/srun:feat` 的「架構變更」「設計決策密集」升級條件在此不適用；僅保留下列兩條升級規則：

- **首次派發**：改動觸及安全敏感路徑（auth、payment、API key 處理、session 管理）→ `{coderModel}` 設為 `opus`，並**聯動設 `{securityReview}=true`**（觸發 Step 5 安全 review——同一訊號同款待遇）。此升級改變使用者授權時預期的重量（Tier 2 標籤是輕量），派發前的宣告必須加一行白話揭露：「觸及安全敏感路徑：Coder 升 Opus 並加跑 adversarial 安全 review，重量高於一般 Tier 2，不要就喊停」；只揭露不阻斷，使用者未回應即繼續
- **Retry 動態升級**：升級模式與 Tier 3 同一套，見共用檔 `${CLAUDE_SKILL_DIR}/../feat/references/retry-loop.md`

判定保守。一般小改動維持 sonnet。

---

## 流程

### Step 1: 整理需求與場景判定

從對話中擷取：

1. **問題描述**：什麼壞了 / 要改什麼
2. **預期行為**：修好後應該怎樣
3. **可能影響的檔案**：根據問題描述搜尋定位
4. **場景判定**：獨立小功能／改動（場景 i），或進行中 change 的驗收修正（場景 ii——記下 change 名稱，供 Step 3 讀取該 change 的 artifacts）

宣告：「Tier 2 srun:fix：{問題摘要}」

**進度曝光（原生 task 清單）**：harness 有原生 task 工具（TaskCreate）時，把本次步驟序列建成 harness task（Coder、條件性安全 review、註解整理、Spec 複核），每步 settle 即更新狀態，retry 或 BLOCKED 在對應 task 註記一句。

### Step 2: 建立工作分支

分支策略依專案慣例判斷（git 歷史與 CLAUDE.md），需開分支時命名 `fix-<描述>`；慣例看不出來時預設開分支（場景 ii 通常已在該 change 的功能分支上，直接沿用）。

### Step 3: Spec 影響判斷（spec-first，派發前）

派發前先判斷本次改動是否影響規格——讓 Coder 拿到**權威版驗收依據**（spec 原文而非對話轉述），實作與測試斷言都有 ground truth：

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

### Step 4: 派發 Coder Agent（含測試職責）

依「Model 策略」判定 `{coderModel}`（首次派發預設 sonnet，安全敏感路徑升 opus）。派發前把 `${CLAUDE_SKILL_DIR}/../feat/references/` 下 `command-conventions.md` 與 `tester-conventions.md` 的**絕對路徑**分別代入 `{commandConventionsPath}` 與 `{testerConventionsPath}`。使用 Task tool 派發 subagent（model: {coderModel}）。模板語法：`{變數}` 代入實際值；`{若...：}` 區塊成立留內文、不成立整段刪：

```
你是 Coder Agent，兼負本次修復的測試職責（Tier 2 不派獨立 Tester）。

開始工作前：
1. 用 Skill tool 先載入 `srun:guidelines`（寫 code 的行為守則，務必先讀再動手），再從你 context 的 available-skills 挑選與專案 stack、本次改動相關的知識型 skill 載入（開發慣例、程式碼風格、測試框架用法等）；載入失敗（缺裝／改名）→ 略過該項繼續，不要停
2. Read 測試撰寫守則：{testerConventionsPath}（撰寫規範、排除規則、執行節奏、輸出必含皆在其中；讀不到 → 停下回報）
3. 讀取專案的 CLAUDE.md 了解專案慣例

問題描述：
{從對話擷取的問題描述}

預期行為：
{修復後的預期結果}

{若 Step 3 有更新 spec：}
驗收依據（spec 原文，權威版——實作與測試斷言以此為準）：
{更新後的 spec 段落，含來源路徑}

可能相關的檔案：
{列出定位到的檔案路徑}

請修復此問題：
- 遵循專案設計系統與慣例
- 善用既有的共用模組與 utils
- 只修改必要的部分，不做額外重構

測試職責：
- 邏輯／行為類修復 → 撰寫重現該問題的測試（先寫後修或修完補寫皆可），確保 bug 不再現；撰寫與排除規則依守則檔，無法以真實 import／掛載驗證 → 列入「無法測試的模組清單」，不硬寫
- 純視覺／樣式類改動 → 不寫新測試

完成後 settle 前自跑三件套：lint + typecheck + 專案測試套件（指令選用一律依 {commandConventionsPath}，測試執行節奏依守則檔；紅燈就地修復不計 retry，就地修不掉 → 停下回報）

輸出：
1. 修改的檔案路徑與變更摘要
2. 修復邏輯的簡要說明（供 retry 時作為上下文參考）
3. 測試檔路徑與測試結果（無新測試則說明原因，如「純樣式改動」）
4. 無法測試的模組清單（依守則檔格式；無則寫「無」）
5. 順手觀察（選填）：依 guidelines 規範回報路過看到的無關死碼／可疑處，一行一項；無則省略
```

**Coder 回報測試修不掉／settle 後測試仍紅時**：進入 Retry 迴路（見下方）。

**無法測試清單的消費者（Tier 2 報告行）**：Coder 回報的「無法測試的模組清單」非空、且模組被頁面使用時（grep 模組名稱於頁面／元件原始碼，一條指令），把**受影響頁面清單寫進完成報告的「人工確認提示」段**（例：「模組 `useXxx` 無法被單元測試覆蓋，被頁面 A、B、C 使用，建議確認時順手檢查」）。Tier 2 **不派** verify-flow——洞的本質是「人工確認時不知道爆炸半徑」，給人 grep 清單即補上資訊差，要看多細由人決定。

### Step 5: 安全 review（`{securityReview}=true` 時才跑，adversarial Opus）

改動觸及安全敏感路徑時（與 Coder 升 Opus 同一訊號），Coder settle 後、註解整理之前，自動補派一次 **adversarial Opus review**——與 Tier 3 同款訊號同款待遇。安全殺傷力與改動行數無關（兩行 session 邏輯的爆炸半徑可大於二十檔 UI 重構）；分級管的是流程重量，不該分掉安全底線。

- Orchestrator 載入 `srun:review` skill，依其 Reviewer Subagent Prompt 模板展開後派發 subagent（`subagent_type: opus-reviewer`——plugin agent 已鎖 model 與工具白名單；展開後 prompt 已內含完整規範，subagent 不另行載入 `srun:review`），`{adversarial}=true`、scope 為本次修改檔案的 diff
- **FAIL 的修復走完整靜態關卡**：Coder 修 → settle 前自跑三件套（lint + typecheck + test）→ Sonnet targeted re-check（只審修復 diff）。計數與上限沿用下方 Retry 迴路（各 gate 最多 3 輪，達上限停下來問人）；嚴重安全問題 → 直接停下來問人
- Subagent 派發失敗 → 停下來問人（隔離不變量：不退化為主對話自審）

### Step 6: 註解整理（Sonnet subagent）

所有 gate settle 後（Coder，含條件性的 Step 5 安全 review）、Spec 輕量複核前，orchestrator 先掃一眼本次 diff 的註解量：**明顯偏多（複述、敘述、開發過程類垃圾可見）才派發**註解整理 Agent；diff 乾淨就跳過本步，報告註明「跳過（diff 註解乾淨）」。

- 載入 `srun:comment` skill 取得整理規範與輸出格式
- 使用 Task tool 派發 subagent，固定 **`subagent_type: general-purpose` + `model: sonnet`**
- scope 為「本次修改的檔案清單」（Coder 產出，含其所寫測試檔），由 orchestrator 注入 prompt 的 `{changedFiles}`
- 整理 Agent 依守則**直接套用 Edit**並自跑 lint --fix（指令選用與功能型指令註解的保護清單皆由 `comment` 守則規範）
- 整理完成後 orchestrator **重跑改動檔的 scoped 測試**作為安全網（誤刪指令註解由保護清單計數防守、手滑動到 code 由 scoped 測試接住，不需全量）；失敗回整理 Agent 修正（最多 1 輪），仍失敗 → 停下來問人

### Step 7: Spec 輕量複核（commit 前）

Step 3 已做過 spec-first 影響判斷；此處只做一行輕量複核，防**實作過程中的範圍外溢**（Coder 實際改動超出派發宣告範圍時，可能觸及 Step 3 未評估的規格）：

- 比對 Coder 實際修改的檔案清單與 Step 3 的判斷範圍：一致 → 在完成摘要標記「Spec 已同步（前移）」或「Spec 無影響」；超出 → 對超出部分補跑一次 Step 3 的影響判斷，有影響即補更新 spec

**不執行 commit。** Commit 時機由人工決定（通常在 change 歸檔時一併處理）；Spec 改動與 code 同一個 commit 交付。

### Step 8: 報告結果

顯示完成摘要（含註解整理與 Spec 同步結果），提示人工確認修復結果。

**retro 記錄（一行呼叫）**：載入 `srun:retro` skill，依其記錄模式把本次 run 的事件與統計 append 進全域收件匣（事件表、條目格式與閾值提醒以該 skill 為單一來源，此處不複製）。append 失敗不阻斷報告，註記即可。

---

## Retry 迴路

通用規格（一輪定義、不計輪、修復派發附帶物、三件套 settle、升級模式）見共用檔 `${CLAUDE_SKILL_DIR}/../feat/references/retry-loop.md`：與 Tier 3 同一套，任一 gate 首次失敗進入迴路時先讀。

本 tier 的 gate 迴路有二：測試（Coder 就地修不掉、回報主對話）、條件性的安全 review（Step 5）。修復派發對象皆為 Coder（Tier 2 無獨立 Tester，測試檔亦歸 Coder 修）。

---

## 輸出格式

### 完成

```
## Tier 2 完成：{問題摘要}

### Agent Pipeline 結果
- Coder: ✓ 完成（N 個檔案，M 個測試通過／純樣式無新測試）
- 安全 review: ✓ PASS（僅 {securityReview}=true 時列出）
- 註解整理: ✓ 清除 X 處 / 改寫 Y 處（scoped 測試重跑通過）（或「跳過（diff 註解乾淨）」）

### Pipeline 統計
- Coder 派發次數：{coderCalls}（含 retry）

### Retry 記錄
（若有 retry，列出每輪的問題與修復摘要）

### 人工確認提示（無法自動驗證的部分）
（Coder 的無法測試清單非空且被頁面使用時列出爆炸半徑，例：「模組 `useXxx` 無法被單元測試覆蓋，被頁面 A、B、C 使用，建議確認時順手檢查」；無則「無」）

### 順手觀察（Coder 路過看到的，僅供參考）
（Coder 有回報時原樣列出——情報不是待辦，不觸發任何 retry 或派發；無則整段省略）

### Spec 同步（spec-first）
- 場景：{(i) 獨立改動 | (ii) 驗收修正：{changeName}}
- {Step 3 更新的 spec 段落列表} 或「無影響（純實作問題）」
- 輕量複核：{範圍一致 | 超出範圍，已補更新 {spec}}

### 下一步
請人工確認修復結果。Commit 時機由人工決定（Spec 改動與 code 同 commit）。
```

### 遇到阻塞

依共用模板（`feat` skill 目錄下的 `references/blocked-report.md`，自本 skill 目錄為 `${CLAUDE_SKILL_DIR}/../feat/references/blocked-report.md`）：先輸出 debug 檔 `.claude/debug/fix-{timestamp}.md`，再向使用者顯示阻塞摘要（用模板中 fix 版的選項行）。

---

## Guardrails

- Coder prompt 直接描述問題（含 Step 3 更新後的 spec 驗收依據），不要求 agent 自讀完整變更 artifact；不在 prompt 中貼入檔案內容，讓 agent 自行讀取
- Coder（含 retry 派發）一律先載入 `guidelines` 行為守則再動手——從生成端約束過度設計與越界改動
- Coder 的輸出（檔案清單 + 修復邏輯）由 orchestrator 保留，用於 retry
- Spec 影響判斷前移至派發前（spec-first）不可跳過
