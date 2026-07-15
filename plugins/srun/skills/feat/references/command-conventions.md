# 指令偵測與執行慣例（feat／fix／comment／tester 共用）

派發會跑 lint／typecheck／test 的 agent 時，指令的偵測與選用一律依本檔；各 skill 不重複規範細節（`guidelines` 已明示委派）。呼叫方以絕對路徑注入 `{commandConventionsPath}`，或載入相關 skill 的 agent 自 `${CLAUDE_SKILL_DIR}/../feat/references/command-conventions.md` 讀取。

指令按 stack 分節（與 `coder-skills-map.md` 的偵測結果一致）：JS/TS 專案走「package manager＋各指令解析」兩節，.NET 專案走「.NET 節」；「通則」所有 stack 共用。

## 偵測 package manager（JS/TS 專案）

- 讀 `package.json` 的 `scripts` 與 `packageManager` 欄位；或 root lockfile（`pnpm-lock.yaml` / `yarn.lock` / `package-lock.json`）判定 PM。
- 下述以 pnpm 書寫，依偵測到的 PM 調整（yarn／npm 等）。

## 通則

- **先判斷 gate 存不存在（三態）**：
  - 有專案 script（如 `pnpm lint`）→ 跑 script
  - 無 script、但工具與設定在（eslint＋config／tsconfig＋typescript／vitest＋test 檔）→ fallback 本地 binary（`pnpm exec eslint` 等，依偵測到的 PM）
  - **工具整個不存在** → **跳過此 gate，回報註明「專案無 X，未執行」**（跳過 ≠ 通過，不可報綠燈）
- 判準看真實能力（dep＋config＋標的），不只看有沒有 npm script。
- **絕不用裸 `npx`**——可能觸發下載或用錯版本。

## 各指令解析（JS/TS 專案）

- **Lint**：**只掃改動檔**，不掃全專案（全專案掃會讓既有 error 淹沒你的新 error）。`pnpm exec eslint <改動檔> --fix`——沿用專案 eslint config、只限定檔案（依偵測到的 PM）。專案 lint script 若寫死全專案，改用這條 scoped 形式。
- **Typecheck**：優先專案自己的 `typecheck` script。**下列為 Nuxt 專案適用**：無 script 時用 `pnpm exec nuxi typecheck`（裸跑 vue-tsc 在未 prepare 的 Nuxt 專案會炸）；非 Nuxt 專案 fallback 該 stack 對應的型別檢查（如 `tsc --noEmit`）。
- **Test**：專案 test script（如 `pnpm test`）；無則 fallback `pnpm exec vitest run`。逐項失敗（`--reporter=verbose`）、scoped 用法與執行節奏（scoped 先、全量後）見 `tester-conventions.md`。

## 各指令解析（.NET 專案）

三態 gate 判準同通則，「工具」對位如下（無 package.json 不表示無 gate）：

- **Lint**：`dotnet format <sln/csproj> --include <改動檔>`（格式與 analyzer 修正，只限定改動檔）；驗證模式用 `--verify-no-changes`。專案根有 `.editorconfig` 即視為 lint gate 存在。
- **Typecheck 對位＝編譯**：`dotnet build --nologo`（編譯即型別檢查，恆存在，不可跳過）。
- **Test**：`dotnet test --nologo`；scoped 用 `--filter`（語法依測試框架）。測試專案不存在（無 `*Tests.csproj` 類專案）→ 依三態規則跳過並回報。
- CI／custom target 若在（`Directory.Build.props` 定義的額外 target 或 repo script），優先沿用專案自己的。
