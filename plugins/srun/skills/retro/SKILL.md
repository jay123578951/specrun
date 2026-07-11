---
name: retro
argument-hint: "[--archive]"
description: Pipeline 回饋迴路（雙模式）— 記錄模式（預設）：feat/fix 完成時對照事件表，把偏離快樂路徑的事件與統計 append 進 ~/.claude/specrun-feedback/runs.jsonl 跨專案收件匣（手動呼叫＝臨時補記，含入口引導漏接／誤觸發事件）；歸檔模式（--archive）：聚類收件匣找跨專案模式、必要時順 session 指針開採 transcripts，產出附證據的 kit 優化提案，徵求同意後歸檔。受益對象是 kit 不是專案——教訓寫回 kit 的 prompt，不寫專案 CLAUDE.md。
---

Kit 的回饋迴路。Pipeline 教訓的大宗是 **kit 級**（agent 行為由 kit 的 prompt 決定、跨專案同一套）——寫進單一專案的 CLAUDE.md 等於埋掉。本 skill 在源頭（orchestrator 事發時在場）做語義記錄，比事後開採 transcripts 的關鍵字偵測召回率高得多；歸檔模式再把收件匣消化成 kit 優化提案。這是唯一能讓 pipeline 隨使用次數變便宜的複利投資。

**設計原則**：迴路必須自我維護，否則死於運維疲勞——記錄自動（內建在 feat/fix 完成報告尾端）、消化手動但有閾值提醒。自動 append 點**只進不出**；歸檔是唯一出口且需人同意。

---

## 檔案（跨專案單一收件匣）

| 檔案 | 用途 |
|------|------|
| `~/.claude/specrun-feedback/runs.jsonl` | 收件匣：每次 pipeline run 一行 JSON（質化事件＋量化統計同檔） |
| `~/.claude/specrun-feedback/runs-archive.jsonl` | 歸檔：`--archive` 消化並經人同意後，條目從收件匣移入此處 |

目錄不存在時建立。transcripts 約 30 天會被清理，所以條目的 session 指針只是深挖線索，**一行事實必須自足**。

---

## 記錄模式（預設）

**呼叫點**：`feat` Step 7 與 `fix` Step 8 的完成報告尾端內建一行呼叫（SSOT——事件表與條目格式只活在本 skill，feat/fix 不各抄一份）。手動呼叫 `/srun:retro` ＝ 臨時補記（如人工驗收後才發現的問題）。

**記錄什麼——對照列舉事件表，偏離快樂路徑全記**：

| 事件類型（固定詞彙） | 觸發 |
|---------------------|------|
| `gate_fail` | 任一 gate FAIL（記哪關、第幾輪：test / reviewer / verify / security-review / comment-safety-net） |
| `counter_2` / `counter_3` | 任一迴路 counter 達 2（升 Opus）／達 3（停損問人） |
| `test_defect` | test-defect 仲裁通道被使用（記上訴結果：測試改了／上訴不成立） |
| `review_defect` | review-finding 申辯通道被使用（記上訴結果：finding 撤回／維持／升級問人） |
| `flaky` | verify-flow 標記 flaky |
| `blocked` | 任何 BLOCKED（記子原因：工具未就緒／環境／登入牆） |
| `scope_exceeded` | G7 規模超標回報（路由誤判實錘——`docs/routing-cases.md` 新題候選） |
| `acceptance_fix` | Tier 2 場景 (ii) 驗收修正 |
| `pragma_restored` | 註解整理保護清單計數攔到誤刪並補回 |
| `security_review` | W4 安全 review 被觸發（記結果） |
| `untestable_modules` | Tester 無法測試清單非空（記模組數與消費路徑：verify-flow OR 觸發／報告行） |
| `guidance_miss` | 入口／交界引導漏接：意圖已浮現卻未宣告、未跳選項，或 AI 越線動手（記漏在哪個交界、當時句式） |
| `guidance_false_trigger` | 引導誤觸發：Tier 1 小改被跳選項、純討論被逼問模式（記觸發位置與當時語境） |
| `guidance_hit` | 引導正確出現且被採用（記交界與所選選項）——漏接率的分母，沒有它只有分子算不出率 |

**引導事件（`guidance_*`）的通道差異**：漏接與誤觸發多發生在**未進 pipeline 的 session**（純討論、診斷、被越線的對話），走不到 feat/fix 完成報告——主通道是**手動補記**（事發當下呼叫 `/srun:retro`）。`guidance_hit` 若引導進線 pipeline，由 feat/fix 完成報告順帶記；未進線的命中（如選「繼續討論」）不強求記錄。

**快樂路徑也記**（events 為空陣列）——統計行是日後調閾值（counter ≥ 2、3 輪停損）的分母。

**條目格式**（一行 JSON append；事實不寫解讀）：

```json
{"ts":"<ISO 時間>","project":"<專案名>","tier":"feat|fix|guidance","subject":"<change 名或問題摘要>","session":"<session id 或 transcript 路徑（深挖指針）>","events":[{"type":"<事件表固定詞彙>","fact":"<一行事實>","where":"<指路：哪關/第幾輪/哪個模組>"}],"stats":{"coderCalls":N,"testerCalls":N,"reviewerCalls":N,"counters":{"test":N,"reviewer":N,"verify":N}},"observations":[{"fact":"<事件表之外、值得 kit 注意的異常>","evidence":"<證據指路>"}]}
```

- `events`：只用事件表的固定詞彙；一行事實＋指路，**不寫解讀**（解讀是歸檔模式的事）
- `tier: "guidance"`：未進 pipeline 的引導事件補記條目——`stats` 省略、`subject` 寫當時對話主題一句
- `observations`（開放觀察欄）：模型判斷有事件表之外值得 kit 注意的異常時，以事實＋證據格式一併記，同樣不寫解讀——收集工具本身也是被優化的對象（反覆出現的觀察，消化時提案收進事件表）
- **閾值提醒**：append 時順手數行數（`wc -l`），收件匣 > 30 筆 → 在 pipeline 完成報告加一行：「回饋收件匣已累積 N 筆，建議擇時執行 `/srun:retro --archive` 消化」。30 只是提醒閾值，不是歸檔門檻

---

## 歸檔模式（`--archive`，手動）

無條件執行——樣本少時誠實標註「樣本 N 筆，模式辨識信心有限」照跑，不設進入門檻。**建議用法**（不強制）：乾淨 session、在 kit repo 跑（消化是重活，且提案要對照 kit 條文）。

流程：

1. **讀收件匣**：全量讀 `runs.jsonl`
2. **聚類找跨專案模式**：同類事件反覆出現（同一 gate 常 FAIL、同類 blocked、同一 skill 條文常被誤解）→ 候選模式；開放觀察欄反覆出現的觀察 → 提案收進事件表（自我完善迴路）
3. **需要時深挖**：順條目的 session 指針開採 transcripts 還原細節——量大時平行派發 subagent 分片閱讀
4. **歸因分類**：每個候選模式先歸因、再開修法——歸因決定提案型態，避免所有模式都反射性地「加一段條文」：

   | 歸因 | 修法 |
   |------|------|
   | 條文不清（規範存在但模糊／易誤讀） | 重寫該段條文 |
   | 條文缺席（無規範可循，agent 只能猜） | 新增條文，或事件表／守則新增項目 |
   | 執行漂移（條文清楚但未被遵守） | 先查條文是否過長、關鍵句被埋沒——調結構或前移；同處反覆漂移才考慮升 hook 等機制層 |
   | 一次性失誤（無系統性成因） | 不動 kit——報告註記即可，不為非問題過度工程 |

5. **產出 kit 優化提案報告**：每條提案標註歸因、附證據（哪幾筆條目、transcript 位置）、指向 kit 的哪個檔案哪段條文、建議修法；`scope_exceeded` 實例同時列為 `docs/routing-cases.md` 新題候選
6. **徵求同意**：提案呈報使用者，**經同意才動 kit 檔案**（動慣例影響全域，是「該問人」的類型）
7. **歸檔**：已消化條目 append 到 `runs-archive.jsonl` 並自 `runs.jsonl` 移除（唯一出口）

**不寫專案 CLAUDE.md**——單專案受惠＋各專案規則各自演化是 drift 溫床；專案特定教訓由人工手動加。

---

## Guardrails

- 記錄模式純機械：對照事件表、一行事實、不寫解讀、不打斷 pipeline（append 失敗不阻斷完成報告，註記即可）
- 事件表與條目格式以本 skill 為單一來源；feat/fix 只保留一行呼叫，不複製表格
- 自動 append 點只進不出；歸檔是唯一出口且必經人同意
- session 指針是深挖線索非依賴——transcripts 約 30 天清理，一行事實必須自足
- 歸檔模式動 kit 檔案前必徵求同意；提案必附證據（grounding）
