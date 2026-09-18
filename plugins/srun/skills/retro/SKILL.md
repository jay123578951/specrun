---
name: retro
argument-hint: "[--archive]"
description: 追蹤 kit 裡的防錯規則還需不需要存在（雙模式）— 記錄模式（預設）：feat/fix 完成時記下本次 run 哪些防錯規則開了、開了之後那關過沒過，並記偏離快樂路徑的事件進跨專案收件匣；手動呼叫＝臨時補記（含入口引導漏接／誤觸發）；歸檔模式（--archive）：算各防錯規則的開啟率與攔截率，過期的提拆除實驗、出事的提補強。教訓寫回 kit 的 prompt，不寫專案 CLAUDE.md。
---

retro 追蹤 kit 裡每條**防錯規則**（為了防模型犯錯而寫的規則，模型不再犯時會過期）還需不需要存在。每次 run 記下哪些防錯規則開了、開了之後那關過沒過；歸檔時算開啟率與攔截率，過期的提拆除，出事的提補強。找問題不消失，降為底線守門：拆了某條之後事件有沒有回升。

記錄自動（內建在 feat/fix 完成報告尾端）、歸檔手動但有三種時機提醒。收件匣**只進不出**；歸檔是唯一出口且需人同意。

---

## 檔案（跨專案共用）

| 檔案 | 用途 |
|------|------|
| `~/.claude/specrun-feedback/runs.jsonl` | 收件匣：每次 pipeline run 一行 JSON（防錯規則開關＋事件＋統計同檔） |
| `~/.claude/specrun-feedback/runs-archive.jsonl` | 歸檔：`--archive` 消化並經人同意後，條目從收件匣移入此處 |
| `~/.claude/specrun-feedback/experiments.jsonl` | 進行中的拆除實驗清單：一行一個實驗（拆哪條、從何時起、盯哪個開關、要跑幾次、基準值）；到期或判定後改 status，整檔可改寫 |
| `${CLAUDE_SKILL_DIR}/../../scripts/retro-usage.mjs` | 用時與 token 統計腳本：讀本 session 的 transcript 算出 `usage` 欄，純確定性 |

目錄不存在時建立。transcripts 約 30 天會被清理，所以條目的 session 指針只是深挖線索，**一行事實必須自足**。

---

## 記錄模式（預設）

**呼叫點**：`feat` Step 7 與 `fix` Step 8 的完成報告尾端內建一行呼叫（SSOT——開關表、事件表與條目格式只活在本 skill，feat/fix 不各抄一份）。手動呼叫 `/srun:retro` ＝ 臨時補記（如人工驗收後才發現的問題）。

### 防錯規則開關（`guards`，每次 run 必記，快樂路徑也記）

這是計算開啟率與攔截率的分母。沒出事的 run 也要記「沒開」，否則永遠算不出比例。取值不靠記憶：回頭看本 run 的實際派發參數與各 gate 結果。

| 欄位 | 取值 | 對應哪條防錯規則 | 從哪拿 |
|------|------|------------------|--------|
| `coderStart` | `{model: sonnet\|opus, reason: null\|architecture\|security\|design-open}` | feat Step 3／fix Model 策略的起跑升級判定 | 本 run **第一次** Task 派發 Coder 的 `model` 參數與判定理由。升級模式改的是修復派發，不影響此欄。`fix` 只有 `security` 一種理由 |
| `adversarialFirst` | `true\|false` | feat Step 6 首派 Reviewer 的 adversarial 判定 | 首次派 Reviewer 時代入的 `{adversarial}`。`fix` 無此判定記 `null` |
| `escalation` | `{opened: bool, gate: test\|reviewer\|verify\|security-review\|null, round: N\|null, passedNextRound: bool\|null}` | retry-loop 升級模式（counter 達 2 全部修復派發升 Opus） | 開啟時記哪個 gate 在第幾輪觸發；`passedNextRound`＝開啟後該 gate 下一輪是否通過（停損或中止記 `null`） |
| `recheck` | `{runs: N, fail: M}` | review Targeted Check 用 Sonnet 不升 Opus | 本 run 派了幾次 targeted re-check、其中幾次判 FAIL |
| `securityReview` | `{triggered: bool, verdict: PASS\|WARNING\|FAIL\|null}` | fix Step 5 安全 review 條件觸發 | `fix` 專用；`feat` 的安全訊號已由 `adversarialFirst` 覆蓋，記 `null` |
| `stopLoss` | `{fired: bool, humanChoice: continue\|skip\|manual\|rerun\|null}` | retry-loop 各 gate 最多 3 輪停下問人 | 觸發時記人的裁決：`continue`＝再修一輪、`skip`＝跳過該 gate 交驗收、`manual`＝人工接手、`rerun`＝調 spec 重跑 |
| `modelIds` | `{coder: "<id>", reviewer: "<id>\|null"}` | 分辨「規則過期」與「模型換代」 | Coder 與 Reviewer 報告首行自報的 model id（`Coder model: …`／`Reviewer model: …`）；缺自報時填派發 alias |

### 用時與 token（`usage`，腳本算，不手填）

回答「時間去哪了」「花了多少 token」「是 AI 慢還是在等人」。執行：

```
node "${CLAUDE_SKILL_DIR}/../../scripts/retro-usage.mjs" [session-id] --since <pipeline 起跑的 ISO 時間>
```

session-id 省略時取當前專案最近修改的 transcript（run 結束當下呼叫即為本 session）；`--since` 傳 Step 1 宣告的時間，排除 run 之前的討論，不知道就省略。輸出單行 JSON 原樣併進條目的 `usage` 欄：`wallClockMin`（起訖跨度）、`dispatchMin`（各 subagent 用時加總，平行時會大於跨度）、`waitingHumanMin`（助理停下到人回話的空檔，已扣掉同時有 agent 在跑的部分）、`mainThread`（orchestrator 自己的 model 與四種 token）、`byModel`（各 model 的派發數、用時、token）、`dispatches`（每次派發的角色、批次、首派或修復、model、分鐘、四種 token）。token 記數量不記金額，金額歸檔時用當時價目表算（cache 讀取與一般輸入價差大）。

腳本靠派發時的 `description` 分辨角色與批次：以角色開頭（Coder／Tester／Reviewer／驗證／re-check／註解），批次寫「第 N 批」，修復派發含「修復」或「修正」。feat／fix 的派發一律照這個寫法。腳本失敗（找不到 transcript、node 不在）→ `usage` 記 `null`，回顯註記一句，不阻斷。

### 事件（底線守門，對照事件表列舉，偏離快樂路徑全記）

| 事件類型（固定詞彙） | 觸發 |
|---------------------|------|
| `gate_fail` | 任一 gate FAIL（記哪關、第幾輪：test / reviewer / verify / security-review / comment-safety-net）；Reviewer 只有 FAIL 才算，PASS with WARNING 記下一列 |
| `review_warning` | Reviewer 判 PASS with WARNING（記條數與歸屬 coder／tester／spec；不計 `counters.reviewer`，與 retry-loop「targeted re-check 不計輪」一致） |
| `counter_2` / `counter_3` | 任一迴路 counter 達 2（升 Opus）／達 3（停損問人）；開關細節記在 `guards.escalation`／`guards.stopLoss`，事件只留一行事實 |
| `test_defect` | test-defect 仲裁通道被使用（記上訴結果：測試改了／上訴不成立） |
| `review_defect` | review-finding 申辯通道被使用（記上訴結果：finding 撤回／維持／升級問人） |
| `flaky` | verify-flow 標記 flaky |
| `blocked` | 任何 BLOCKED（記子原因：工具未就緒／環境／登入牆／工具能力不足） |
| `scope_exceeded` | G7 規模超標回報（路由誤判實錘——`docs/routing-cases.md` 新題候選） |
| `acceptance_fix` | `fix` 場景 (ii) 驗收修正 |
| `pragma_restored` | 註解整理保護清單計數攔到誤刪並補回 |
| `security_review` | 安全 review 被觸發（記結果）；開關記在 `guards.securityReview`，事件留一行事實 |
| `untestable_modules` | 無法測試清單非空（feat=Tester、fix=Coder 回報；記模組數與消費路徑：verify-flow OR 觸發／報告行） |
| `verify_gap` | verify-flow 報告「待人確認」非空、或改動形態非瀏覽器可及（記落到人工的 spec 驗收點數與原因：示範資料缺情境／執行形態摸不到／工具能力不足） |
| `artifact_drift` | tasks／design／proposal 記載與現場不符（指名檔案不存在、驗收判準與既有規格或測試衝突、驗證方法實測不可執行、量測數字失準）；記不符類型與處置（自行對正／回報問人／照字面硬做） |
| `guidance_miss` | 入口／交界引導漏接：意圖已浮現卻未宣告、未跳選項、該進流程卻就地處理，或 AI 越線動手（記漏在哪個交界、當時句式） |
| `guidance_false_trigger` | 引導誤觸發：純討論或三錨全中的小改被宣告制帶進流程（使用者以 escape hatch 撤回＝行為實錘；撤回率是誤觸發的下界——容忍型不撤回，量不到）、被逼問模式（記觸發位置與當時語境） |
| `guidance_hit` | 引導正確出現且被採用：宣告制進線未撤回，或選項被採納（記交界與去向，含帶入的 change 名或新題目）——漏接率的分母，沒有它只有分子算不出率；掛錯 change 先記 observations，再犯升格 |

**引導事件（`guidance_*`）的通道差異**：漏接與誤觸發多發生在**未進 pipeline 的 session**（純討論、診斷、被越線的對話），走不到 feat/fix 完成報告——主通道是**手動補記**（事發當下呼叫 `/srun:retro`）。`guidance_hit` 若引導進線 pipeline，由 feat/fix 完成報告順帶記；未進線的命中（如選「繼續討論」）不強求記錄。

### 條目格式

一行 JSON append；事實不寫解讀。append 前以本節格式為模板產生單行 JSON 序列化輸出，不自創欄位、不憑記憶拼格式：

```json
{"ts":"<ISO 時間>","project":"<專案名>","tier":"feat|fix|guidance","subject":"<change 名或問題摘要>","session":"<session id 或 transcript 路徑（深挖指針）>","guards":{"coderStart":{"model":"sonnet","reason":null},"adversarialFirst":false,"escalation":{"opened":false,"gate":null,"round":null,"passedNextRound":null},"recheck":{"runs":0,"fail":0},"securityReview":{"triggered":false,"verdict":null},"stopLoss":{"fired":false,"humanChoice":null},"modelIds":{"coder":"<id>","reviewer":"<id>"}},"usage":<retro-usage.mjs 的輸出原樣，失敗記 null>,"events":[{"type":"<事件表固定詞彙>","fact":"<一行事實>","where":"<指路：哪關/第幾輪/哪個模組>"}],"stats":{"coderCalls":N,"testerCalls":N,"reviewerCalls":N,"counters":{"test":N,"reviewer":N,"verify":N}},"observations":[{"fact":"<事件表之外、值得 kit 注意的異常>","evidence":"<證據指路>"}]}
```

- `guards`：七個欄位每次都要有值，沒開就記 `false`／`null`／`0`，不省略整個欄位
- `usage`：只放腳本輸出，不手填、不改數字
- `events`：只用事件表的固定詞彙；一行事實＋指路，**不寫解讀**（解讀是歸檔模式的事）。快樂路徑 events 為空陣列
- `stats.counters`：只數 retry-loop 定義的「輪」（gate FAIL 回主對話派修再重驗），WARNING 修復與 targeted re-check／re-run 不算
- `tier: "guidance"`：未進 pipeline 的引導事件補記條目——`guards`、`usage` 與 `stats` 省略、`subject` 寫當時對話主題一句
- `observations`（開放觀察欄）：模型判斷有事件表之外值得 kit 注意的異常時，以事實＋證據格式一併記，同樣不寫解讀——收集工具本身也是被優化的對象（反覆出現的觀察，消化時提案收進事件表）

### 回顯（append 後在完成報告尾端輸出，讓人不開檔案就知道記了什麼）

```
retro 已記：事件 {N} 筆（{型別列舉，無則「無」}）
防錯規則：起跑 {model}｜adversarial {是/否}｜升級模式 {未開/第 N 輪開→下輪過/未過/中止}｜re-check {N 次 M FAIL}｜安全 review {無/PASS/WARNING/FAIL}｜停損 {未觸發/觸發→{humanChoice}}
用時：{wallClockMin} 分（派發 {dispatchMin}、等人 {waitingHumanMin}）｜輸出 token {各 model 加總，k 為單位}｜Opus 佔派發用時 {百分比}（usage 為 null 時此行寫「用時：未取得（{原因}）」）
```

### 歸檔提醒（append 時順手檢查，符合的各加一行在回顯之後；30 只是提醒閾值，不是歸檔門檻）

| 時機 | 檢查 | 提醒句 |
|------|------|--------|
| 累積夠多 | `wc -l` 收件匣 > 30 筆 | 「回饋收件匣已累積 N 筆，建議擇時執行 `/srun:retro --archive` 消化」 |
| 拆除實驗到期 | `experiments.jsonl` 有 `status: active` 的實驗，數 `startedAt` 之後收件匣＋歸檔的 run 數 ≥ `targetRuns` | 「拆除實驗『{rule}』已滿 {targetRuns} 筆，可以判了」 |
| 模型換代 | 本次 `guards.modelIds` 任一值與收件匣最後一筆（收件匣空則看歸檔最後一筆）不同 | 「{coder/reviewer} model 從 {舊} 換成 {新}，歸檔時前後資料分開算」 |

---

## 歸檔模式（`--archive`，手動）

無條件執行——樣本少時誠實標註「樣本 N 筆，模式辨識信心有限」照跑，不設進入門檻。**建議用法**（不強制）：乾淨 session、在 kit repo 跑（消化是重活，且提案要對照 kit 條文）。

流程：

1. **讀收件匣**：全量讀 `runs.jsonl` 與 `experiments.jsonl`；讀取、統計與聚類一律以 JSON 解析處理（各條目序列化間距不保證一致，grep 字面比對會漏樣本）
2. **算防錯規則開啟統計與成本**（機械，從 `guards` 與 `usage` 欄直接算，不需解讀）：每個開關一列——樣本數、開啟率、開了之後那關的通過率、開了比沒開多花的用時與 token、與上一輪歸檔的比較。另列用時分布：每次 run 的跨度、派發用時依角色與首派／修復分組、等人時間占比、各 model 的 token 與依當時價目表換算的金額。`modelIds` 有換代時前後分開列。`guards`／`usage` 欄缺席的舊條目不進分母。統計裡開啟率極低、開了跟沒開的通過率相當、或通過率差距撐不起多付的成本的規則，列為**拆除候選**，交下方第 6 步歸因
3. **判進行中的實驗**：到期的實驗把實驗期間的指標值與 `baseline` 並列，給出「守住／沒守住／樣本不足」三選一的判定，寫進報告；判定後把該行 `status` 改為 `done` 並附結論
4. **聚類找跨專案模式**：同類事件反覆出現（同一 gate 常 FAIL、同類 blocked、同一 skill 條文常被誤解）→ 候選模式；開放觀察欄反覆出現的觀察 → 提案收進事件表（自我完善迴路）
5. **需要時深挖**：順條目的 session 指針開採 transcripts 還原細節——量大時平行派發 subagent 分片閱讀
6. **歸因分類**：每個候選模式先過立案門檻——①有實付成本（多付輪次、無效判定、髒 diff）？②事發當時 AI 有沒有自我導正？導正了就不立案，即使反覆發生，那是能力紅利不是缺口；③失敗有沒有自察訊號？無訊號的（假 PASS 類）才是真缺口，因為自我導正的前提是察覺得到。三關未過 → 報告註記即可。過門檻的先歸因、再開修法——歸因決定提案型態，避免所有模式都反射性地「加一段條文」：

   | 歸因 | 修法 |
   |------|------|
   | 條文不清（規範存在但模糊／易誤讀） | 重寫該段條文 |
   | 條文缺席（無規範可循，agent 只能猜） | 新增條文，或事件表／守則新增項目 |
   | 執行漂移（條文清楚但未被遵守） | 先查條文是否過長、關鍵句被埋沒——調結構或前移；同處反覆漂移才考慮升 hook 等機制層 |
   | 防錯規則過期（第 2 步的拆除候選：開啟率低、開了跟沒開的通過率一樣、或通過率差距撐不起成本） | 提拆除實驗：拆哪條、盯 `guards` 哪個欄位或哪個事件、跑幾次 run、基準值是多少；經同意後寫進 `experiments.jsonl` 並改 kit。只量得出開啟率的是補推理類；防亂做類量不出開啟率，只能直接拆、盯對應事件有沒有回升 |
   | 一次性失誤（無系統性成因） | 不動 kit——報告註記即可，不為非問題過度工程 |

7. **產出 kit 優化提案報告**：固定先放第 2 步的開啟統計表與第 3 步的實驗判定，再列提案。每條提案標註歸因、附證據（哪幾筆條目、transcript 位置）、指向 kit 的哪個檔案哪段條文、建議修法；`scope_exceeded` 實例同時列為 `docs/routing-cases.md` 新題候選。**每條提案必答「最便宜等效替代」**：有沒有更便宜的修法能達到同等效果（一句條文 vs 一段規範 vs 新機制）？答不出「為何便宜版不夠」的提案不成立——防 kit 越修越肥。拆除提案同樣要答：拆掉之後靠什麼接住（既有事件表／另一條規則／不需要接）
8. **徵求同意**：提案呈報使用者，**經同意才動 kit 檔案與 `experiments.jsonl`**（動慣例影響全域，是「該問人」的類型）
9. **歸檔**：已消化條目 append 到 `runs-archive.jsonl` 並自 `runs.jsonl` 移除（唯一出口）

**實驗條目格式**（`experiments.jsonl`，一行一個）：

```json
{"rule":"<拆哪條：檔案＋條文一句>","startedAt":"<ISO 時間>","targetRuns":N,"watch":"<guards 欄位路徑或事件型別>","baseline":"<拆之前的值＋樣本數>","status":"active|done","verdict":null|"<守住／沒守住／樣本不足＋一句依據>"}
```

**不寫專案 CLAUDE.md**——單專案受惠＋各專案規則各自演化是 drift 溫床；專案特定教訓由人工手動加。

---

## Guardrails

- 記錄模式純機械：對照開關表與事件表、一行事實、不寫解讀、不打斷 pipeline（append 失敗不阻斷完成報告，註記即可）
- `guards` 七個欄位缺一即條目不完整；取值回頭看實際派發參數與 gate 結果，不憑記憶。`usage` 只放腳本輸出
- 歸檔模式動 kit 檔案或實驗清單前必徵求同意；提案必附證據（grounding）
