---
name: fix
argument-hint: "[問題描述]"
description: 輕量 Pipeline：決策已在對話收斂、不動模組邊界、且不需建立新的 OpenSpec artifact 的小改動時使用（跨檔案 bug 修復、小型 UI 調整、模組微調、進行中 change 的驗收修正）。需要 spec 記錄（新增 API/元件、行為值得規格化）、改變模組邊界、決策收斂成本高（分支彼此相依）或需拆批改用 feat；單行/純樣式微調直接在對話改即可。
---

輕量版 Agent Pipeline。

與 `/srun:feat`（完整版）的差異：
- 不建立新的變更 artifact — 需求從對話定案取得（場景 (ii) 可回寫**既有** change artifact，見下方）
- 只派發 Coder（測試由 Coder 自寫，不派獨立 Tester 與 Reviewer）
- Spec 同步走「派發前 Spec 影響判斷＋commit 前輕量複核」（非完整 change 歸檔流程，如 /opsx:sync / archive）

**Input**: 對話中已描述問題或需求。未描述清楚時，先釐清再啟動。

---

## 適用判斷

**路由判準**（檔案數僅為輔助訊號，不是門檻）：

| 判準 | 走向 |
|------|------|
| 決策已在對話收斂 ＋ 不動模組邊界 ＋ 不需建立**新的** OpenSpec artifact | **本 skill（`/srun:fix`）** |
| 需要 spec 記錄（新增 API/元件，介面契約本身即規格）、改變模組邊界（抽出共用介面、調整依賴方向）、決策收斂成本高（分支彼此相依）需完整收斂流程、或變更需拆批 | `/srun:feat` |
| 瑣碎微調（單行修正、純樣式、文案） | 主對話直改 |

**微決策路徑**：需求帶著 1-2 個彼此獨立的未定小決策時，不必升 `/srun:feat`——在對話中把這幾題收斂定案後即可派發。判斷軸是「決策是否已收斂」，不是「有沒有做過決策」。

**兩種進入場景**：

1. **場景 (i) 獨立小功能／改動**：主對話討論定案後派發。
2. **場景 (ii) 進行中 change 的驗收修正**：`/srun:feat` 人工驗收發現的問題，不大到重跑 `/srun:feat`、但有決策且要執行品質。此場景當作全新的 `fix` run 起跑——不繼承 `feat` 的 retry 次數或已升級的 model（Coder 從 sonnet 重起，升級條件照常適用）。

---

## 專案配置

### Agent Knowledge Skills

與 `/srun:feat` 同步：orchestrator 不預判知識型 skill 清單，派發 prompt 只強制 `srun:guidelines`，其餘由 Coder 自行從 available-skills 挑選與 stack、本次改動相關的知識型 skill 載入（Coder 兼寫測試，測試框架類 skill 一併自取）。

| Agent | Skills（必載） | 可選 Skills | 用途 |
|-------|---------------|------------|------|
| Coder | `srun:guidelines` | 自行從 available-skills 挑選 | `guidelines` 為行為守則（最小可行、只改必要的地方、自主判斷邊界；stack 無關恆載）；知識型 skill（開發慣例、程式碼風格、元件拆分守則、測試框架用法）由 Coder 自取 |

### Model 策略

| Agent | Model |
|-------|-------|
| Coder | sonnet（預設）/ opus |
| 安全 review（條件性，見 Step 5） | opus（adversarial） |

Coder 預設 sonnet。本 skill 為決策已收斂的小改動，故 `/srun:feat` 的「架構變更」「設計決策密集」升級條件在此不適用；僅保留下列兩條升級規則：

- **首次派發**：改動觸及安全敏感路徑（auth、payment、API key 處理、session 管理）→ `{coderModel}` 設為 `opus`，並**聯動設 `{securityReview}=true`**（觸發安全 review（Step 5）——同一訊號同款待遇）。此升級改變使用者授權時預期的重量（本 skill 標籤是輕量），派發前的宣告必須加一行白話揭露：「觸及安全敏感路徑：Coder 升 Opus 並加跑 adversarial 安全 review，重量高於一般 `fix`，不要就喊停」；只揭露不阻斷，使用者未回應即繼續
- **Retry 動態升級**：升級模式與 `/srun:feat` 同一套，見共用檔 `${CLAUDE_SKILL_DIR}/../feat/references/retry-loop.md`

判定保守。一般小改動維持 sonnet。

判定結果連同理由記進報告結果（Step 7）的 retro 條目（`guards.coderStart`）：`fix` 的理由只有 `security` 一種，維持 `sonnet` 記 `null`。記錄口徑見 `srun:retro`。

---

## 流程

### Step 1: 整理需求與場景判定

從對話中擷取：

1. **問題描述**：什麼壞了 / 要改什麼
2. **預期行為**：修好後應該怎樣
3. **可能影響的檔案**：根據問題描述搜尋定位
4. **場景判定**：獨立小功能／改動（場景 i），或進行中 change 的驗收修正（場景 ii——記下 change 名稱，供 Spec 影響判斷（Step 3）讀取該 change 的 artifacts）

宣告：「srun:fix：{問題摘要}」

### Step 2: 開工作分支

一律從所在分支開 `fix-<描述>`；場景 (ii) 已在該 change 的 `feat/` 分支上時沿用不另開。

### Step 3: Spec 影響判斷（spec-first，派發前）

派發前先判斷本次改動是否影響規格——讓 Coder 拿到**權威版驗收依據**（spec 原文而非對話轉述），實作與測試斷言都有 ground truth：

```
1. 根據問題描述與定位到的檔案，比對相關規格：
   - openspec/specs/    （OpenSpec 主規格庫）
   - 場景 (ii)：openspec/changes/<name>/ 下的 specs/ 與 design.md
   - 專案 CLAUDE.md 中定義的其他設計文件位置
2. 判斷：
   ├─ 無影響（純實作問題：行為不變的 bug 修復、實作瑕疵）→ 直接進 Coder 實作（Step 4）派發
   ├─ 場景 (i) 有影響 → 先更新 openspec/specs/ 對應段落，再派發
   └─ 場景 (ii) 影響在 spec/design 層 → 先回寫 change artifact
      （與需求變更「先回寫 artifact 再續跑」同一原則），再派發
3. 更新後的 spec 段落作為驗收依據注入 Coder 派發 prompt（見 Coder 實作（Step 4））
```

判斷中若發現其實需要**新的** spec（新增 API/元件、行為值得規格化）→ 這不是本 skill 該做的事，停下建議升 `/srun:feat`。

Spec 改動先留在工作區，不單獨 commit——最後與 code 同一個 commit 交付（原則：規格與程式碼一起交付）。

### Step 4: Coder 實作（含測試職責）

依「Model 策略」判定 `{coderModel}`（首次派發預設 sonnet，安全敏感路徑升 opus）。派發前把 `${CLAUDE_SKILL_DIR}/../feat/references/` 下 `command-conventions.md` 與 `tester-conventions.md` 的**絕對路徑**分別代入 `{commandConventionsPath}` 與 `{testerConventionsPath}`。使用 Agent tool 派發 subagent（model: {coderModel}）。模板語法：`{變數}` 代入實際值；`{若...：}` 區塊成立留內文、不成立整段刪。

```
你是 Coder Agent，兼負本次修復的測試職責（本流程不派獨立 Tester）。

開始工作前：
1. 用 Skill tool 先載入 `srun:guidelines`（寫 code 的行為守則，務必先讀再動手），再從你 context 的 available-skills 挑選與專案 stack、本次改動相關的知識型 skill 載入（開發慣例、程式碼風格、測試框架用法等）；載入失敗（缺裝／改名）→ 略過該項繼續，不要停
2. Read 測試撰寫守則：{testerConventionsPath}（撰寫規範、排除規則、執行節奏、輸出必含皆在其中；讀不到 → 停下回報）
3. 讀取專案的 CLAUDE.md 了解專案慣例

問題描述：
{從對話擷取的問題描述}

預期行為：
{修復後的預期結果}

{若 Spec 影響判斷（Step 3）有更新 spec：}
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

完成後、交回結果前自跑三項檢查：lint + typecheck + 專案測試套件（指令選用一律依 {commandConventionsPath}，測試執行節奏依守則檔；紅燈就地修復不計 retry，就地修不掉 → 停下回報）

輸出（第一行自報你實際使用的 model，格式：`Coder model: <id>`；缺這行視為報告不完整）：
1. 修改的檔案路徑與變更摘要
2. 修復邏輯的簡要說明（供 retry 時作為上下文參考）
3. 測試檔路徑與測試結果（無新測試則說明原因，如「純樣式改動」）
4. 無法測試的模組清單（依守則檔格式；無則寫「無」）
5. 規格缺口（必填）：依 guidelines 守則 1 回報 spec 沒交代、你自行拍板的商業規則，每條寫「spec 沒寫什麼、你選了什麼、code 位置」；確認沒有就寫「無」，不可省略
6. 沒把握的註解（必填）：依 guidelines 守則 2 回報你寫了但沒把握的註解，每條寫「檔案:行號、註解原文、沒把握的原因」；確認沒有就寫「無」，不可省略
7. 順手觀察（選填）：依 guidelines 規範回報路過看到的無關死碼／可疑處，一行一項；無則省略
```

**Coder 回報測試修不掉／交回結果後測試仍紅時**：進入 Retry 迴路（見下方）。

**無法測試清單的消費者（報告行）**：Coder 回報的「無法測試的模組清單」非空、且模組被頁面使用時（grep 模組名稱於頁面／元件原始碼，一條指令），把**受影響頁面清單寫進完成報告的「要你親手驗的」段**（例如「模組 `useXxx` 無法被單元測試覆蓋，被頁面 A、B、C 使用，建議確認時順手檢查」）。本流程 **不派** verify-flow；要看多細由人決定。

### Step 5: 安全 review（`{securityReview}=true` 時才跑，adversarial Opus）

改動觸及安全敏感路徑時（與 Coder 升 Opus 同一訊號），Coder 交回結果後、Spec 輕量複核之前，自動補派一次 **adversarial Opus review**——與 `/srun:feat` 同款訊號同款待遇。

- Orchestrator 載入 `srun:review` skill，依其 Reviewer Subagent Prompt 模板展開後派發 subagent（`subagent_type: opus-reviewer`——plugin agent 已鎖 model 與工具白名單；展開後 prompt 已內含完整規範，subagent 不另行載入 `srun:review`），`{adversarial}=true`、scope 為本次修改檔案的 diff
- **FAIL 的修復走完整靜態關卡**：Coder 修 → 交回結果前自跑三項檢查（lint + typecheck + test）→ Sonnet targeted re-check（只審修復 diff）。計數與上限沿用下方 Retry 迴路（各 gate 最多 3 輪，達上限停下來問人）；嚴重安全問題 → 直接停下來問人
- Subagent 派發失敗 → 停下來問人（派發失敗也不改由主對話自己審）

### Step 6: Spec 輕量複核（commit 前）

Spec 影響判斷（Step 3）已做過 spec-first 影響判斷；此處只做一行輕量複核，防**實作過程中的範圍外溢**（Coder 實際改動超出派發宣告範圍時，可能觸及 Spec 影響判斷未評估的規格）：

- 比對 Coder 實際修改的檔案清單與 Spec 影響判斷的判斷範圍：一致 → 不用標記；超出 → 對超出部分補跑一次 Spec 影響判斷，有影響即補更新 spec，並列進完成報告的「AI 自行裁決」（人沒同意過這段 spec 改動）
- Coder 有回報「規格缺口」→ 每條視同 Spec 影響判斷找到的 spec 影響，補寫進對應 spec（場景 (i) 主規格、場景 (ii) 該 change 的 delta spec）；缺口條目同時列進完成報告供人確認

### Step 7: 報告結果

顯示完成報告（格式見「輸出格式」）。報告只放要人看或要人決定的事：開頭一行講結果，其餘各段有內容才出現，沒有就整段省略、不寫「無」。各段的來源：

- **AI 自行裁決**：
  - Spec 輕量複核（Step 6）發現 Coder 改超出範圍、自行補寫的 spec 段落
  - Coder 缺套件、沒寫測試的模組（寫出套件名，問要不要裝）
- **規格缺口**：Spec 輕量複核（Step 6）寫進 spec 的條目，註明寫進哪個 spec
- **要你親手驗的**：Coder 實作（Step 4）回報的無法測試清單的受影響頁面
- **沒把握的註解**：Coder 各輪回報的條目；後來修復時已刪掉的不列
- **順手看到的**：Coder 回報的順手觀察，原樣列入。它是情報不是待辦，不觸發任何 retry 或派發

一般修復輪的過程不列，只在開頭那行寫退回修過幾次。報告後不跳選項：fix 的後續（繼續驗收、commit、回到 feat 的驗收）依情境不同，由人接著說。

**retro 記錄**：載入 `srun:retro` skill，依其記錄模式把本次 run 的防錯規則開關（`guards` 七欄，分別是起跑 model 與理由、安全 review 有無觸發與判定、升級模式開在哪關第幾輪與下輪過沒過、targeted re-check 次數與 FAIL 數、達上限時人的裁決、Coder／Reviewer 自報的 model id；`adversarialFirst` 在 fix 記 `null`）、事件與統計 append 進全域收件匣；報告的「retro」節照該 skill「從 feat／fix 呼叫」的回顯規則，只有歸檔提醒或記錄失敗時出現（開關表、事件表、條目格式、回顯與提醒以該 skill 為單一來源，此處不複製）。開關取值回頭看本 run 的實際派發參數與 gate 結果，不憑記憶；`usage` 欄跑該 skill 指定的統計腳本取得（傳整理需求與場景判定（Step 1）宣告的時間作 `--since`）。append 失敗不阻斷報告。

---

## Retry 迴路

通用規格（一輪定義、不計輪、修復派發附帶物、交回結果前的三項檢查、升級模式）見共用檔 `${CLAUDE_SKILL_DIR}/../feat/references/retry-loop.md`：與 `/srun:feat` 同一套，任一 gate 首次失敗進入迴路時先讀。

本流程的 gate 迴路有二：測試（Coder 就地修不掉、回報主對話）、條件性的安全 review（Step 5）。修復派發對象皆為 Coder（本流程無獨立 Tester，測試檔亦歸 Coder 修）。

---

## 輸出格式

### 完成

```
## srun:fix 完成：{問題摘要}
改了 {N} 個檔案，{測試結果}{，安全 review 通過}{，spec 更新 S 段（{哪幾段}）}{；中間退回修過 K 次}。

### AI 自行裁決（確認你同不同意）
- {做了什麼判斷、依據或理由，一條一行}

### 規格缺口（AI 替你決定的規則，已補進 spec；不接受的告訴我，我改程式並從 spec 刪掉）
- {spec 沒寫什麼｜AI 選了什麼｜code 位置｜寫進哪個 spec}

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

- `{測試結果}`：`新增 M 個測試全過`｜`純樣式，沒有新測試`
- `，安全 review 通過`：只在 `{securityReview}=true` 時出現
- `，spec 更新 S 段`：Spec 影響判斷（Step 3）與 Spec 輕量複核（Step 6）實際改了 spec 才出現，括號內寫 spec 名與段落名
- `；中間退回修過 K 次`：K ＝本 run 的修復派發次數，零次整句省略
- 開頭以外各段有內容才出現，沒有就整段省略

### 遇到阻塞

依共用模板（`feat` skill 目錄下的 `references/blocked-report.md`，自本 skill 目錄為 `${CLAUDE_SKILL_DIR}/../feat/references/blocked-report.md`）：先輸出 debug 檔 `.claude/debug/fix-{timestamp}.md`，再向使用者顯示阻塞摘要（用模板中 fix 版的選項行）。

---

## Guardrails

- Agent tool 派發的 `description` 一律以角色開頭（Coder／Tester／Reviewer／驗證／re-check），修復派發含「修復」或「修正」——retro 的用時統計靠它分辨每次派發是誰、首派還是修復
- Coder prompt 直接描述問題（含 Spec 影響判斷（Step 3）更新後的 spec 驗收依據），不要求 agent 自讀完整變更 artifact；不在 prompt 中貼入檔案內容，讓 agent 自行讀取
- Coder（含 retry 派發）一律先載入 `guidelines` 行為守則再動手——從生成端約束過度設計與越界改動
- Spec 影響判斷前移至派發前（spec-first）不可跳過
