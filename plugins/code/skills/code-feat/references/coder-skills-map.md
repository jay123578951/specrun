# Coder 額外 Skills 預判表（feat／fix 共用）

Orchestrator 派發 Coder 前，根據 task／問題內容判斷必載 skills（`code-guidelines`, `vue`, `vue-best-practices`, `nuxt`, `antfu`）之外還需要哪些額外 skills，寫入 `{additionalSkills}`：

- 涉及 store / state → 加 `pinia`
- 涉及 CSS utility / atomic → 加 `unocss`
- 涉及 build config / plugin → 加 `vite`
- 涉及路由 / middleware / navigation guard / route params → 加 `vue-router-best-practices`
- 涉及 DOM 事件 / 瀏覽器 API / 常見 composable 場景（local storage、media query、resize、clipboard 等）→ 加 `vueuse-functions`
- 專案使用 pnpm（`package.json` 含 `"packageManager": "pnpm@..."` 或根目錄存在 `pnpm-lock.yaml`）且涉及依賴 / workspace / catalog / patch → 加 `pnpm`
- 專案為 monorepo（根目錄 `Glob turbo.json` 命中）且跨 package → 加 `turborepo`
