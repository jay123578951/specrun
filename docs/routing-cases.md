# 路由回歸案例集（G9）

> **性質**：kit repo 的維護工具——**不進 plugin 出貨、不被 runtime 載入、不直接影響路由**。它是改 description 措辭時的校準基準（考卷）：路由推薦的準確度活在 `code-feat` / `code-fix` 的 description 措辭裡，措辭會被改；改完拿本表逐句問模型「這個需求會路由到哪個 Tier / 指令」對答案，**全對才放行**。錯誤死在 kit repo，到不了真實開發。
>
> **維護**：每次動到 `code-feat` / `code-fix` 的 skill description（含 `scripts/sync-descriptions.mjs` 重新生成 command 副本）後掃一遍。retro 迴路（`runs.jsonl`）中出現 G7 規模超標事件＝路由誤判實錘，消化時把誤判實例加為新題——案例集跟實戰長大。
>
> **判準版本**：2026-07 審查第 21 條定案——主判準為「決策狀態」＋「是否需要新的 OpenSpec artifact」；檔案數僅輔助訊號。典型錯誤型態：改寫 description 時只顧新意圖、掉了舊排除條件（如「新增 API/元件 → Tier 3」在改寫中遺失 → 新元件被送 Tier 2 → 一路綠燈但 spec 庫靜默漏記）。

## 案例

| # | 需求句（canonical） | 預期路由 | 判準依據 |
|---|--------------------|---------|---------|
| 1 | 「做一個使用者資料匯出 CSV 的新功能，含後端 API 與前端下載按鈕」 | Tier 3（`/code:feat`） | 新增 API/元件 → 需 spec 記錄 |
| 2 | 「手機版導覽列在窄螢幕會蓋住內容，修一下（layout 元件＋樣式檔＋一個頁面）」 | Tier 2（`/code:fix`） | 跨檔案 bug 修復、決策明確、不需新 artifact |
| 3 | 「把送出按鈕的文字『送出』改成『儲存』」 | Tier 1（主對話直改） | 純文案微調 |
| 4 | 「照我們剛剛討論定案的排序邏輯改法做——改兩個 composable 和一個頁面」 | Tier 2（`/code:fix`） | 決策已在對話收斂（場景 i） |
| 5 | 「剛跑完的 change 驗收時發現日期格式顯示錯誤，小修一下」 | Tier 2（`/code:fix`，場景 ii） | 進行中 change 的驗收修正；不大到重跑 Tier 3 |
| 6 | 「新增一個可重用的 DatePicker 元件，之後多個表單會用」 | Tier 3（`/code:feat`） | 新增元件 → 需 spec 記錄（即使初期檔案不多） |
| 7 | 「整個結帳流程要重新設計，可能要分幾個階段做」 | Tier 3（`/code:feat`，先 explore/decisions/propose） | 決策分支多、變更需拆批 |
| 8 | 「卡片之間的間距改成 16px」 | Tier 1（主對話直改） | 純樣式微調 |
| 9 | 「email 驗證的 regex 漏掉 `+` 號，單一 util 檔改一行」 | Tier 1（主對話直改） | 單行修正 |
| 10 | 「加入 Google 第三方登入」 | Tier 3（`/code:feat`） | 新功能、需 spec 記錄（且安全敏感） |
| 11 | 「錯誤提示改用既有的 toast 元件顯示——剛剛已討論定案，動三個頁面共用的 error handler」 | Tier 2（`/code:fix`） | 微決策已收斂、沿用既有元件、不需新 artifact |
| 12 | 「重構 stores 目錄，把五個 store 的重複邏輯抽成共用 util」 | Tier 3（`/code:feat`） | 大型重構跨模組＋新增共用介面 |
| 13 | 「加一個 `/api/health` 端點回傳版本資訊，很小的改動」 | Tier 3（`/code:feat`） | **陷阱題**：檔案少但新增 API → 需 spec 記錄；「很小」不是判準 |
| 14 | 「頁面 title 有錯字」 | Tier 1（主對話直改） | 純文案 |
| 15 | 「這功能要即時更新還是手動刷新？還沒想清楚，先做做看」 | 不派發——先收斂決策（對話釐清；分支多用 `/opsx:explore`＋`/code:decisions`） | 決策未收斂不進任何 pipeline；收斂後再判 Tier |

## 考卷記錄

| 日期 | description 版本 | 結果 | 備註 |
|------|-----------------|------|------|
| 2026-07-03 | 0.10.0（第 21 條新判準版：feat/fix description 重寫後） | 15/15 | 首次建卷即以新 description 全數通過；#13 為防「排除條件在改寫中遺失」的哨兵題 |
