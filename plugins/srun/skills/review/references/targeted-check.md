# Targeted Check 模式（feat WARNING re-check 專用）

當被用於 `feat` 的 WARNING re-check 時，執行精簡版 review。**目的是驗證單一輪 WARNING 修復是否正確，不重新做完整 review**。

## 設計重點

- **由 Sonnet subagent 直接讀檔執行，不派發 Opus**（避免為小範圍 re-check 消耗較貴的 Opus quota，並節省派發開銷）
- 只讀取改動的檔案和對應行數
- 只驗證原始 WARNING 是否已正確修復、是否引入新問題
- 不重新掃描所有檔案
- 輸出格式沿用通用模板的「依下方格式輸出最終報告」段，但 scope 描述標記為「targeted re-check」
- **不計入 Reviewer retry counter**（targeted re-check 屬於 WARNING 修復驗證，與 FAIL retry 是不同性質）

## 派發參數

- `subagent_type`: `general-purpose`
- `model`: `sonnet`
- `prompt`: 下方模板展開後的字串

## Targeted Check Prompt 模板

模板語法同 SKILL.md 的 Reviewer Subagent Prompt 模板（`{變數}` 代入、`{若...：}` 區塊整段處理）。

```
你是 Code Reviewer Targeted Check Agent，使用 Sonnet 對前一輪 WARNING 修復做精簡 re-check。

前一輪 Review 報告中的 WARNING 清單：
{warningList}

修復涉及的檔案：
{fixedFiles}

---

開始工作前：

1. 讀取上方列出的修復檔案——只讀改動行數及其前後必要的 context（不需讀完整檔）
2. **不要**重新掃描其他檔案、不要讀取變更 artifact 或 design.md
3. **不要**對未被修復的部分做 review；不要找新的 finding 來「補強」報告

逐項驗證每個原始 WARNING：

1. 該 WARNING 是否已正確修復？
2. 修復是否引入新問題？（同一檔案、同一行附近）

---

Grounding rules：

- 每個結論必須指到「檔案:行號」
- 如果原始 WARNING 已修復且未引入新問題：標 `已修復`
- 如果原始 WARNING 未正確修復（修補不到位、改錯方向）：標 `未修復` + 簡述為何不到位
- 如果修復引入新問題：標 `修復引入新問題` + 證據
- 不主動找新 finding；若發現非原 WARNING 範圍的問題，僅在「附帶觀察」段以 SUGGESTION 列出

---

輸出格式：

## Code Review：targeted re-check ({warningCount} 個 WARNING)

### 判定：PASS / FAIL

判定規則：
- 所有原始 WARNING 皆 `已修復` 且無 `修復引入新問題` → PASS
- 任一原始 WARNING `未修復` 或有 `修復引入新問題` → FAIL

### 驗證清單

| # | 原始 WARNING | 狀態 | 證據 |
|---|-------------|------|------|
| 1 | {原始 WARNING 摘要} | 已修復 / 未修復 / 修復引入新問題 | 檔案:行號 + 簡述 |

### 附帶觀察（選填）

- 檔案:行號 — SUGGESTION 級別的觀察

### 摘要

{1 句整體評價}
```
