# Coder／Tester Skills 解析表（feat／fix 共用）

Orchestrator 派發 Coder／Tester 前，依「**偵測 stack → 取對應清單 ∩ 已安裝**」解析要注入 prompt 的 skill 清單。

## Stack 偵測（派發前先做一次）

讀專案根目錄 `package.json`，看 `dependencies` / `devDependencies`：

- 含 `vue` 或 `nuxt` → **Vue stack**，用下方「Vue 節」的清單
- 皆無命中 → **通用模式**，Coder 只載 `srun:guidelines`（行為守則，stack 無關且隨 srun 本體出貨、必在），Tester 不強制載任何知識型 skill（依測試框架自行運用），兩者皆不預判額外 skills

`package.json` 不存在或讀不到（非 JS/TS 專案）→ 視為通用模式。

## 交集規則（所有清單共用）

上述清單為「**推薦清單**」，非強制存在。Orchestrator 以**自身 context 的 available-skills 列表**為準取交集：推薦清單中未出現在 available-skills 的項目直接**略過**（該 stack pack 未裝或部分裝時的正常情形），只把交集結果寫進 subagent prompt。派發 prompt 另附「Skill 載入失敗→略過繼續，不要停」作第二層保險。

比對時**忽略命名空間前綴**：推薦清單寫裸名，available-skills 中的 plugin skill 帶 `<plugin>:` 前綴（如 `vue-stack:vue`、`web-common:pnpm`），以冒號後的名稱比對——`vue` 命中 `vue-stack:vue` 即算已裝。寫進 subagent prompt 時用 available-skills 裡的**完整名稱**（含前綴），裸名會載入失敗。

---

## Vue 節（偵測到 Vue stack 時）

**Coder 必載**：`guidelines`, `vue`, `vue-best-practices`, `nuxt`, `antfu`
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

## 通用節（未偵測到已知 stack 時）

**Coder 必載**：`guidelines`
**Tester 必載**：無（依偵測到的測試框架自行運用）
**額外 skills 預判**：無

其他 stack 的推薦清單待補（React／Python／Go 等）——新增時各開一節，沿用相同的偵測＋交集規則。
