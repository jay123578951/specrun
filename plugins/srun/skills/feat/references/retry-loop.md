# Retry 迴路通用規格（feat／fix 共用）

`feat`／`fix` 共用的迴路規則，gate 首次失敗、或 Coder／Tester 停下回報要有人定的事時讀取；各 pipeline 的 gate 差異（誰修、修完重驗什麼）與異議（測試異議、review 異議）見各自 SKILL.md。

## 什麼時候停下來問人

只有兩種：

- Reviewer 也判斷不了的事（依 spec、design、既有規格推不出答案）
- 同一件事第 3 次交到 Reviewer 手上，Reviewer 仍判有問題

嚴重安全問題、環境卡住（操作流程驗證 BLOCKED 的環境與登入牆）照各 pipeline 的規定直接問人，不屬上面兩種。

## 次數怎麼算

開發中與開發完各算各的，算法相同：

- **開發中**（各批 Coder 實作 → Tester 補測試，到 Reviewer 完整審查之前）：以「同一件事」為單位，算這件事交給 Reviewer 裁決的次數，各件事各自算。交給 Reviewer 的時機：
  - Coder 與 Tester 談不攏的異議
  - Coder 或 Tester 停下回報、要有人定才能往下做的事（規格缺口照 `guidelines` 選最保守的做法記下，不在此列）
  - 同一件事修了一次還是沒過
- **開發完**（Reviewer 完整審查起，從 0 開始）：完整審查退回一次算一輪。Reviewer 之後的全部測試、操作流程驗證、實測與報告判有問題退回修，也算一輪。Reviewer 判 PASS with WARNING 修完就好，不算

其他來回都不算次數：Coder 與 Tester 之間的修正與異議、agent 就地自修、targeted re-check／re-run、BLOCKED、flaky 標註。

問人後人做了決定 → 那件事（或完整審查）的次數歸 0，從第 1 次重新算；其他事不受影響。

`fix` 沒有 Tester 與 Reviewer：把「交到 Reviewer 手上」換成「Coder 修完交給測試或安全 review 判一次」，算法相同。

## Reviewer 裁決

開發中交給 Reviewer 的事與兩種異議（測試異議、review 異議，提法見 `feat` SKILL.md），都派 Opus Reviewer 裁決。`fix` 沒有 Reviewer，遇到要有人定的事直接問人。

- targeted 派發（`subagent_type: opus-reviewer`）：只裁這一件事，不重做完整 review。prompt 附這件事的經過（雙方報告或修復回報全文、各自引的依據）
- Reviewer 只依 spec、design、既有規格裁決，不自己發明規則；推不出答案 → 回報「判斷不了」並寫出要問人的題目，主對話停下來問人
- 照裁決做；裁決列進完成報告的「AI 自行裁決」，人驗收時可推翻

## 升級

同一件事第 2 次交到 Reviewer 手上之後，修這件事改派 Opus（不論被派的是 Coder 或 Tester）；開發完的第 2 輪起，該輪修復改派 Opus。其他事照舊 Sonnet。targeted re-check／re-run 是驗證派發，維持 Sonnet。

## 修復派發

- **修復派發 prompt 一律附**：失敗報告（依 gate 不同，分別是失敗測試名稱＋錯誤訊息／Review 報告／驗證報告含截圖或幾何描述）、**前一輪輸出摘要**（檔案清單＋設計決策，避免 context 斷裂）、明確修復指示、**同型位置清單**（finding 屬同一機制在本次改動多處出現的型態，如整批轉換時各處刪掉同款守衛；orchestrator 派修前先 grep 出本次 diff 內的同構位置，修復若涉及規範性文字（spec 條文、合規表、範例、摘要型 artifact）則連同該規則的其他載體一起列，附進 prompt 要求一次修完；非機制型寫「無」）；Reviewer 裁決過的事，附上裁決全文
- **Coder 修復回報必填「沒把握的註解」**：格式同首派輸出，只列本輪新寫的；沒有寫「無」
- **重讀自行判斷**：修復派發已附前輪摘要與失敗報告，通常足以定位；是否回頭重讀 design.md／specs/／CLAUDE.md 由修復 agent 自行判斷
- **修復 agent 交回結果前自跑三項檢查**（lint + typecheck + 相關測試）：紅燈就地修；就地修不掉、或判斷失敗屬測試問題 → 回報主對話（或提出測試異議，見各 SKILL.md）。本 run 已跑過全部測試時，修復 prompt 寫明這點，修復 agent 改用 `tester-conventions.md`「全部測試之後的相關測試」的挑法

## 全部測試只跑一次

一個 run 只跑一次全部測試：feat 在 Reviewer 這關修完後（Step 6.3）、fix 在 Coder 與安全 review 這關過了之後（Step 5.5），都由主對話跑。跑過之後的修復交回時，主對話拿這次修改的檔案清單判斷要不要再跑：

```
這次修改的檔案
  ├─ 含會影響所有測試的檔案（清單見 command-conventions.md）──→ 主對話再跑一次全部測試
  ├─ 專案測試框架沒有順著依賴找相關測試的方法 ──────────────→ 主對話再跑一次全部測試
  └─ 其他 ──────────────────────────────────────────────────→ 不跑，修復 agent 跑過的相關測試就算數
```

主對話再跑全部測試時，跑法照 feat 的 Step 6.3（背景跑、輸出寫檔、只讀摘要和失敗項目）。再跑的全部測試失敗，照原 gate 退回修，次數照上方算法。
