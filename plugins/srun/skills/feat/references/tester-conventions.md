# 測試撰寫守則（feat Tester／fix Coder 共用）

派發 prompt 以絕對路徑指向本檔，寫測試的 agent（feat 的 Tester、fix 的 Coder）開工前必讀；讀不到 → 停下回報，不要在缺守則約束的情況下繼續寫。

## 撰寫測試

- 測試檔放在與源碼同目錄（foo.test.ts）
- 使用 describe/it API 結構
- 純邏輯函式應抽出為獨立模組，測試 import 實際模組（不複製邏輯）
- spec 條文帶量詞（每個／全部／各自）時，fixture 至少含複數個體、且對每個個體斷言——單元素 fixture 驗不出 each 語意

## 排除規則（不要撰寫以下測試）

- TypeScript 型別/介面欄位存在性測試（typecheck gate 已保證型別正確性）
- 靜態原始碼文字比對測試（以 regex／字串比對 source 內容）——驗的是程式碼字面不是行為：合法改寫會誤報回歸、真的邏輯錯誤又驗不到。無法以真實 import／掛載驗證時，唯一出口是列入「無法測試的模組清單」，不得降級為文字比對

## Nuxt composable 的測試策略（三層，依序）— Vue/Nuxt 專屬

> 本節僅適用 Vue/Nuxt 專案；非 Vue 專案跳過。第 1 條「純邏輯抽獨立模組先測」的原則本身 stack 無關，其餘 Nuxt runtime 細節不適用時略過。

1. 純邏輯抽為獨立模組的規則不變（結構層優先）——能測 import 實際模組的先這樣測
2. 殘餘的 Nuxt runtime 依賴：讀 package.json 偵測 `@nuxt/test-utils` 是否已裝——已裝即用它直接測；只在需要重環境的測試檔標 `@vitest-environment nuxt`，純邏輯測試照走輕環境。永不主動安裝依賴
3. 未裝才跳過該模組的單元測試（不要複製邏輯自測），列入「無法測試的模組清單」輸出

## 無法測試時的替代驗證

無法測試清單不是驗證的終點。修復的核心斷言落在清單內時，可改用**可還原的實機驗證**替代：真實環境操作（瀏覽器量測、DB 查詢、CLI 執行），限唯讀或跑完即還原（先備份再動），驗證路徑與結果寫進回報。重量界線：驗證工程超出改動本身量級時，先回報再做，不默默墊高成本。

## 執行測試

工具用法：PM 偵測、專案 script 優先、不裸 `npx` 等指令選用通則見同目錄 `command-conventions.md`。**指令以專案偵測到的測試框架為準**（優先跑專案 test script）；下列以 vitest 為預設範例——需逐項失敗資訊時用 `pnpm exec vitest run --reporter=verbose`，scoped 到特定檔用 `pnpm exec vitest run <路徑>`（依偵測到的 PM；其他框架換用對應指令）。

**執行節奏**：收斂階段 scoped 到改動檔，全綠後跑一次全量當回歸蓋章；節奏自行拿捏，唯一硬規則是**蓋章用的全量必須在最後一次改動之後執行**——先跑全量再改 code，那次全量即過期作廢。

**Settle 前 lint 自查**：對自己新增／修改的測試檔跑 scoped lint（per-file——全量 lint 會被 pre-existing error 淹沒而漏報；指令選用依 `command-conventions.md`），紅燈自修後才交付。

## 輸出必含

- 測試檔案路徑（含補寫/修正了什麼）
- 測試結果（通過/失敗）；若有失敗，列出每個失敗的測試名稱和錯誤原因
- 無法測試的模組清單（模組名稱與跳過原因，如「useXxxApi — 依賴框架 runtime，無法在單元測試中 import」；無則寫「無」）
