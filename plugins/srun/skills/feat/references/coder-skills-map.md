# Coder／Tester Skills 解析表（feat／fix 共用）

Orchestrator 派發 Coder／Tester 前，依「**偵測 stack → 取對應清單 ∩ 已安裝**」解析要注入 prompt 的 skill 清單。

## Stack 偵測（派發前先做一次）

偵測是**註冊表制**：每個 stack 節自帶一行「偵測訊號」，按節在本文件中的順序逐一比對，**首命中即進該節**；全部未命中 → 通用節。訊號一律是可觀察的檔案存在性或檔案內容檢查，不做開放式判斷。

已知限制（刻意接受）：混合 repo（如 Vue 前端＋.NET 後端同 repo）只會進先命中的節，真實需求出現再處理。

新增 stack（React／Laravel／Python／Go 等）＝新開一節並自帶偵測訊號，不回頭改本段。

## 交集規則（所有清單共用）

上述清單為「**推薦清單**」，非強制存在。Orchestrator 以**自身 context 的 available-skills 列表**為準取交集：推薦清單中未出現在 available-skills 的項目直接**略過**（該 stack pack 未裝或部分裝時的正常情形），只把交集結果寫進 subagent prompt。派發 prompt 另附「Skill 載入失敗→略過繼續，不要停」作第二層保險。

比對時**忽略命名空間前綴**：推薦清單寫裸名，available-skills 中的 plugin skill 帶 `<plugin>:` 前綴（如 `vue-stack:vue`、`web-common:pnpm`），以冒號後的名稱比對——`vue` 命中 `vue-stack:vue` 即算已裝。寫進 subagent prompt 時用 available-skills 裡的**完整名稱**（含前綴），裸名會載入失敗。

**載入條件**（所有 stack 節通用）：必載清單項目可帶載入條件（寫在括號內，條件必須是可觀察的偵測訊號，如「依賴含 `nuxt` 才載」，不是開放式判斷）——條件不成立視同不在清單，不載也不算偏離。這與交集是兩層獨立過濾：載入條件管「這專案用不用得上」，交集管「裝了沒」。

---

## Vue 節

**偵測**：根目錄 `package.json` 的 `dependencies` / `devDependencies` 含 `vue` 或 `nuxt`（檔案不存在或讀不到＝未命中）。

**Coder 必載**：`guidelines`, `vue`, `vue-best-practices`, `antfu`, `nuxt`（依賴含 `nuxt` 才載）
**Tester 必載**：`vitest`, `antfu`, `vue-testing-best-practices`

**Coder 額外 skills 預判**（依 task／問題內容判斷，寫入 `{additionalSkills}`）：

- 涉及 store / state → 加 `pinia`
- 涉及 CSS utility / atomic → 加 `unocss`
- 涉及 build config / plugin → 加 `vite`
- 涉及路由 / middleware / navigation guard / route params → 加 `vue-router-best-practices`
- 涉及 DOM 事件 / 瀏覽器 API / 常見 composable 場景（local storage、media query、resize、clipboard 等）→ 加 `vueuse-functions`
- 專案使用 pnpm（`package.json` 含 `"packageManager": "pnpm@..."` 或根目錄存在 `pnpm-lock.yaml`）且涉及依賴 / workspace / catalog / patch → 加 `pnpm`
- 專案為 monorepo（根目錄 `Glob turbo.json` 命中）且跨 package → 加 `turborepo`
- 涉及用 UnoCSS 建構／重構 UI 介面（semantic token、雙 light/dark 主題、元件視覺樣式、micro-interaction polish）→ 加 `antfu-design`（與 `unocss` 分工：`unocss` 管引擎與 rule 語法，`antfu-design` 管設計慣例與 token 命名；純調 utility class 語法只需 `unocss`，要拍板整體視覺／token 系統才加 `antfu-design`）
- 涉及 Nuxt/Nitro server 端（`server/` 下 API routes／event handlers、`nitro.config`、`routeRules`、server 快取 `defineCachedEventHandler`、nitro storage／tasks（排程）／websocket、部署 preset）→ 加 `nitro`（與 `nuxt` 分工：`nuxt` 管框架整合面，`nitro` 補 server 引擎細節；獨立 nitro 專案亦適用）

（額外 skills 同樣過交集規則——推薦到但未裝的略過。）

## .NET 節

**偵測**：根目錄 `Glob *.sln` / `*.slnx` / `global.json` 任一命中；未中再 `Glob *.csproj` 與 `Glob */*.csproj`（查一層即止，不全樹遞迴）。只看檔案存在性、不解析內容；「是否 Web 專案」等細分交給節內載入條件。

**Coder 必載**：`guidelines`, `dotnet-patterns`, `dotnet-webapi`（csproj 含 `Sdk="Microsoft.NET.Sdk.Web"` 才載）
**Tester 必載**：`csharp-testing`, `testcontainers`（測試專案依賴含 `Testcontainers` 套件才載）

**Coder 額外 skills 預判**（依 task／問題內容判斷，寫入 `{additionalSkills}`；依賴訊號查 csproj／`Directory.Packages.props` 的 `PackageReference`，對位 Vue 節查 `package.json`）：

- 涉及 API 介面設計（新 endpoint、版本化、分頁、錯誤格式）→ 加 `api-design`
- 涉及 EF Core entity／關聯／交易／遷移 → 加 `efcore-patterns`
- 涉及查詢效能、慢查詢、索引 → 加 `optimizing-ef-core-queries`、`database-performance`
- 涉及跨 ORM 的 schema 遷移策略（零停機、rollback）→ 加 `database-migrations`
- 依賴含 `Npgsql` 且涉及 DB → 加 `postgres-patterns`；含 `Pomelo.EntityFrameworkCore.MySql`／`MySql.Data` → 加 `mysql-patterns`；含 `StackExchange.Redis` → 加 `redis-patterns`
- 涉及認證／授權／輸入驗證／密鑰處理 → 加 `security-review`
- 涉及容器化／部署／CI → 加 `docker-patterns`、`deployment-patterns`
- 涉及觀測性／tracing／metrics → 加 `configuring-opentelemetry-dotnet`

（隨依賴包存在的搭贈件——`convert-blazor-server-to-webapp`、`minimal-api-file-upload` 等——不列預判、不推薦，交集機制天然容忍。）

## 通用節（所有 stack 節皆未命中時的兜底）

**Coder 必載**：`guidelines`
**Tester 必載**：無（依偵測到的測試框架自行運用）
**額外 skills 預判**：無

其他 stack 的推薦清單待補（React／Laravel／Python／Go 等）——新增時各開一節，沿用相同的偵測＋交集規則。
