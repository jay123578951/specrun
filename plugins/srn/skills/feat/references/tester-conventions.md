# Tester 測試撰寫守則（feat／fix 共用）

派發 prompt 以絕對路徑指向本檔，Tester subagent 開工前必讀；讀不到 → 停下回報，不要在缺守則約束的情況下繼續寫。

## 撰寫測試

- 測試檔放在與源碼同目錄（foo.test.ts）
- 使用 describe/it API 結構
- 純邏輯函式應抽出為獨立模組，測試 import 實際模組（不複製邏輯）

## 排除規則（不要撰寫以下測試）

- TypeScript 型別/介面欄位存在性測試（typecheck gate 已保證型別正確性）

## Nuxt composable 的測試策略（三層，依序）

1. 純邏輯抽為獨立模組的規則不變（結構層優先）——能測 import 實際模組的先這樣測
2. 殘餘的 Nuxt runtime 依賴：讀 package.json 偵測 `@nuxt/test-utils` 是否已裝——已裝即用它直接測；只在需要重環境的測試檔標 `@vitest-environment nuxt`，純邏輯測試照走輕環境。永不主動安裝依賴
3. 未裝才跳過該模組的單元測試（不要複製邏輯自測），列入「無法測試的模組清單」輸出

## 執行測試

優先跑專案 test script（如 `pnpm test`，依專案 package manager 調整）；需要逐項失敗資訊時用 `pnpm exec vitest run --reporter=verbose`。不要用裸 `npx`。

## 輸出必含

- 測試檔案路徑（含補寫/修正了什麼）
- 測試結果（通過/失敗）；若有失敗，列出每個失敗的測試名稱和錯誤原因
- 無法測試的模組清單（模組名稱與跳過原因，如「useXxxApi — Nuxt composable，無法在單元測試中 import」；無則寫「無」）
