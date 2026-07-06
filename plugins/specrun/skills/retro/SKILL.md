---
name: retro
argument-hint: "[--archive]"
description: Pipeline 回饋迴路（雙模式）— 記錄模式（預設）：feat/fix 完成時對照事件表，把偏離快樂路徑的事件與統計 append 進 ~/.claude/sdd-kit-feedback/runs.jsonl 跨專案收件匣（手動呼叫＝臨時補記）；歸檔模式（--archive）：聚類收件匣找跨專案模式、必要時順 session 指針開採 transcripts，產出附證據的 kit 優化提案，徵求同意後歸檔。受益對象是 kit 不是專案——教訓寫回 kit 的 prompt，不寫專案 CLAUDE.md。
---

Kit 的回饋迴路。Pipeline 教訓的大宗是 **kit 級**（agent 行為由 kit 的 prompt 決定、跨專案同一套）——寫進單一專案的 CLAUDE.md 等於埋掉。本 skill 在源頭（orchestrator 事發時在場）做語義記錄，比事後開採 transcripts 的關鍵字偵測召回率高得多；歸檔模式再把收件匣消化成 kit 優化提案。這是唯一能讓 pipeline 隨使用次數變便宜的複利投資。

**設計原則**：迴路必須自我維護，否則死於運維疲勞——記錄自動（內建在 feat/fix 完成報告尾端）、消化手動但有閾值提醒。自動 append 點**只進不出**；歸檔是唯一出口且需人同意。

---

## 檔案（跨專案單一收件匣）

| 檔案 | 用途 |
|------|------|
| `~/.claude/sdd-kit-feedback/runs.jsonl` | 收件匣：每次 pipeline run 一行 JSON（質化事件＋量化統計同檔） |
| `~/.claude/sdd-kit-feedback/runs-archive.jsonl` | 歸檔：`--archive` 消化並經人同意後，條目從收件匣移入此處 |

目錄不存在時建立。transcripts 約 30 天會被清理，所以條目的 session 指針只是深挖線索，**一行事實必須自足**。

---

## 記錄模式（預設）

**呼叫點**：`feat` Step 7 與 `fix` Step 8 的完成報告尾端內建一行呼叫（SSOT——事件表與條目格式只活在本 skill，feat/fix 不各抄一份）。手動呼叫 `/srn:retro` ＝ 臨時補記（如人工驗收後才發現的問題）。

**記錄什麼——對照列舉事件表，偏離快樂路徑全記**：

| 事件類型（固定詞彙） | 觸發 |
|---------------------|------|
| `gate_fail` | 任一 gate FAIL（記哪關、第幾輪：test / reviewer / verify / security-review / comment-safety-net） |
| `counter_2` / `counter_3` | 任一迴路 counter 達 2（升 Opus）／達 3（停損問人） |
| `test_defect` | test-defect 仲裁通道被使用（記上訴結果：測試改了／上訴不成立） |
| `flaky` | verify-flow 標記 flaky |
| `blocked` | 任何 BLOCKED（記子原因：工具未就緒／環境／登入牆） |
| `scope_exceeded` | G7 規模超標回報（路由誤判實錘——`docs/routing-cases.md` 新題候選） |
| `acceptance_fix` | Tier 2 場景 (ii) 驗收修正 |
| `pragma_restored` | 註解整理保護清單計數攔到誤刪並補回 |
| `security_review` | W4 安全 review 被觸發（記結果） |
| `untestable_modules` | Tester 無法測試清單非空（記模組數與消費路徑：verify-flow OR 觸發／報告行） |

**快樂路徑也記**（events 為空陣列）——統計行是日後調閾值（counter ≥ 2、3 輪停損）的分母。

**條目格式**（一行 JSON append；事實不寫解讀）：

```json
{"ts":"<ISO 時間>","project":"<專案名>","tier":"feat|fix","subject":"<change 名或問題摘要>","session":"<session id 或 transcript 路徑（深挖指針）>","events":[{"type":"<事件表固定詞彙>","fact":"<一行事實>","where":"<指路：哪關/第幾輪/哪個模組>"}],"stats":{"coderCalls":N,"testerCalls":N,"reviewerCalls":N,"counters":{"test":N,"reviewer":N,"verify":N}},"observations":[{"fact":"<事件表之外、值得 kit 注意的異常>","evidence":"<證據指路>"}]}
```

- `events`：只用事件表的固定詞彙；一行事實＋指路，**不寫解讀**（解讀是歸檔模式的事）
- `observations`（開放觀察欄）：模型判斷有事件表之外值得 kit 注意的異常時，以事實＋證據格式一併記，同樣不寫解讀——收集工具本身也是被優化的對象（反覆出現的觀察，消化時提案收進事件表）
- **閾值提醒**：append 時順手數行數（`wc -l`），收件匣 > 30 筆 → 在 pipeline 完成報告加一行：「回饋收件匣已累積 N 筆，建議擇時執行 `/srn:retro --archive` 消化」。30 只是提醒閾值，不是歸檔門檻

---

## 歸檔模式（`--archive`，手動）

無條件執行——樣本少時誠實標註「樣本 N 筆，模式辨識信心有限」照跑，不設進入門檻。**建議用法**（不強制）：乾淨 session、在 kit repo 跑（消化是重活，且提案要對照 kit 條文）。

流程：

1. **讀收件匣**：全量讀 `runs.jsonl`
2. **聚類找跨專案模式**：同類事件反覆出現（同一 gate 常 FAIL、同類 blocked、同一 skill 條文常被誤解）→ 候選模式；開放觀察欄反覆出現的觀察 → 提案收進事件表（自我完善迴路）
3. **需要時深挖**：順條目的 session 指針開採 transcripts 還原細節——量大時平行派發 subagent 分片閱讀
4. **產出 kit 優化提案報告**：每條提案附證據（哪幾筆條目、transcript 位置）、指向 kit 的哪個檔案哪段條文、建議修法；`scope_exceeded` 實例同時列為 `docs/routing-cases.md` 新題候選
5. **徵求同意**：提案呈報使用者，**經同意才動 kit 檔案**（動慣例影響全域，是「該問人」的類型）
6. **歸檔**：已消化條目 append 到 `runs-archive.jsonl` 並自 `runs.jsonl` 移除（唯一出口）

**不寫專案 CLAUDE.md**——單專案受惠＋各專案規則各自演化是 drift 溫床；專案特定教訓由人工手動加。

---

## Guardrails

- 記錄模式純機械：對照事件表、一行事實、不寫解讀、不打斷 pipeline（append 失敗不阻斷完成報告，註記即可）
- 事件表與條目格式以本 skill 為單一來源；feat/fix 只保留一行呼叫，不複製表格
- 自動 append 點只進不出；歸檔是唯一出口且必經人同意
- session 指針是深挖線索非依賴——transcripts 約 30 天清理，一行事實必須自足
- 歸檔模式動 kit 檔案前必徵求同意；提案必附證據（grounding）
