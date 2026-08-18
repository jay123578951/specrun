# Retry 迴路通用規格（feat／fix 共用）

兩個 tier 共用的迴路規則，gate 首次失敗進入迴路時讀取；各 pipeline 的 gate 差異（誰修、修完重驗什麼）與申辯通道見各自 SKILL.md。

- **一輪的定義**：「gate 失敗回到主對話 → 派 agent 修 → 重驗」＝該 gate 一輪。各 gate 獨立計數、**各自最多 3 輪**，輪數在同一 Pipeline 內累計不因修復成功重置；達上限 → 停下來問人（問題可能較嚴重或 AI 忽略關鍵細節）
- **不計輪**：agent 就地自修（lint／typecheck／三件套紅燈，未回主對話）、BLOCKED（回主對話是為了問人）、flaky 標註（回主對話是為了告知）、targeted re-check／re-run（驗證派發，非問題回報）
- **修復派發 prompt 一律附**：失敗報告（依 gate：失敗測試名稱＋錯誤訊息／Review 報告／驗證報告含截圖或幾何描述）、**前一輪輸出摘要**（檔案清單＋設計決策，避免 context 斷裂）、明確修復指示
- **機制型 finding 的同型排查**：finding 屬同一機制在本次改動多處出現的型態（如整批轉換時各處刪掉同款守衛）→ 修復指示須要求排查本次 diff 內的同構位置並一次修完，不只修被點名那處
- **重讀自行判斷**：修復派發已附前輪摘要與失敗報告，通常足以定位；是否回頭重讀 design.md／specs/／CLAUDE.md 由修復 agent 自行判斷
- **修復 agent settle 前自跑三件套**（lint + typecheck + 專案 test script）：紅燈就地修不計輪；就地修不掉、或判斷失敗屬測試問題 → 回報主對話（計下一輪，或走申辯通道，見各 SKILL.md）
- **升級模式（全 Pipeline 單一開關，開啟後不關閉）**：任一 gate 進入第 2 輪修復即開啟——此後**所有修復派發升 Opus**（不論被派的是 Coder 或 Tester）。targeted re-check／re-run 是驗證派發，維持 Sonnet 不受影響
