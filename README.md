# specrun

> 為 Vue/Nuxt 專案打造的 Claude Code plugin — 用一個指令跑完 Coder → Tester → Reviewer 的 SDD 工作流。

## 這是什麼

`specrun` 把 Spec-Driven Development 的編排成本壓成一個指令。搭配 [OpenSpec](https://github.com/Fission-AI/OpenSpec) 管理變更規格，Reviewer 透過 Opus subagent 進行獨立 code review。

手動跑 SDD 流程時要自己載 skills、切換 Coder / Tester / Reviewer 三種角色、把 design 與 tasks 貼進對話、最後還要確保 spec 跟 code 同步——這些都能編排，但每次手動拼裝太累。更重要的是 **reviewer 應該獨立**：Coder / Tester / Reviewer 各自派發成獨立 subagent，Reviewer 固定走 Opus 並與其他角色 context 隔離，靠獨立視角避免自評自審讓品質失真。Coder 則依變更性質**動態選模型**——一般功能用 Sonnet，碰到架構變更、安全敏感路徑、設計決策密集或 retry 第 2 輪才升 Opus。所以這個 plugin 把 agent 派發、skill 載入、獨立 review 全包起來，並用**變更分級制度**避免小改動被完整 spec 流程綁住——對話定案的小改動用 `/srn:fix`（spec-first：派發前先同步規格），做新功能才走 `/srn:feat`。Coder 在動手前還會載入 `guidelines` **行為守則**（最小可行、外科手術式改動、自主判斷邊界），從生成端就避免過度設計與越界改動，而非全部留給 Reviewer 事後攔截——預防比 retry 便宜。同樣的預防思路延伸到設計端：`/srn:decisions` 在 explore 與 propose 之間沿決策樹收斂未定分支，避免模糊需求被 propose 包裝成看似完整的 spec、最後才在實作階段爆出來。

## Features

### 指令

| 指令 | 適用情境 | 流程 |
|------|----------|------|
| `/srn:decisions [任務描述]` | 完整新功能、全新 UI 流程設計（決策分支多） | 沿決策樹找出未定分支，逐一收斂後輸出決策清單餵 `/opsx:propose`（不產 spec、不寫 code） |
| `/srn:feat <change-name>` | 新功能、大型重構、跨模組變更 | Coder → Tester → Reviewer ∥ 操作流程驗證 → 註解整理，搭配 OpenSpec 變更 artifact |
| `/srn:fix` | 決策已在對話收斂、不需新 OpenSpec artifact 的小改動（跨檔案 bug fix、小型 UI 調整、composable 微調、驗收修正） | spec-first：派發前 Spec 影響判斷 → Coder + Tester → 註解整理 → commit 前輕量複核 |
| `/srn:review [--staged \| --branch <ref> \| --change <name>]` | 獨立 code review | Opus subagent 獨立審查（與主對話 context 隔離） |
| `/srn:verify-flow [app URL] [驗收依據]` | 觸及 UI/流程的變更 | fresh-context subagent 用 claude-in-chrome 真點擊走完 spec 流程，確認不報錯/不中斷、spec 明文元件與位置成立；不判美感與資料合理性（留給人） |
| `/srn:comment [--staged \| --branch <ref> \| --whole-file]` | 開發收尾清理註解 | Sonnet subagent 以「完成後讀者」視角清除過時/冗餘/思考流程註解（冗餘含語意複述，非僅字面直譯），保留 why 與功能型指令（獨立模式預設只清 diff 鄰近，`--whole-file` 放寬到整檔） |
| `/srn:retro [--archive]` | kit 回饋迴路（記錄自動內建於 feat/fix 完成報告；手動＝補記） | 記錄模式對照事件表把偏離快樂路徑的事件與統計 append 進 `~/.claude/sdd-kit-feedback/runs.jsonl` 跨專案收件匣；`--archive` 聚類找模式、產出附證據的 kit 優化提案（經同意才動 kit、不寫專案 CLAUDE.md） |

> 微調（CSS、文字、單行 fix）建議直接在主對話改，不需走 plugin。完整分級判斷見 [`plugins/specrun/docs/ai-development-pipeline.md`](plugins/specrun/docs/ai-development-pipeline.md)。
>
> 文件權威層級：各 `SKILL.md`（執行契約權威）＞ pipeline doc（方法論）＞ 本 README（摘要）；說法衝突時以 SKILL.md 為準。

### Agent 編排

- **Coder**（Sonnet → Opus 動態切換）— 預設 Sonnet subagent；首次派發前若判定為架構變更 / 安全敏感路徑 / 設計決策密集則升 Opus；任一迴路進入第 2 輪修復即開啟升級模式（全 pipeline 單一開關），此後修復派發一律升 Opus（不再降回；統一規則，綁派發不綁角色）。完成後自跑 lint + typecheck（自修不計 retry）。`/srn:feat` 與 `/srn:fix` 共用同一套 skill 規範：必載 `guidelines`（行為守則）/ `vue` / `vue-best-practices` / `nuxt` / `antfu`，依任務追加 `pinia` / `unocss` / `vite` / `vue-router-best-practices` / `vueuse-functions` / `pnpm` / `turborepo`。Tier 差異在流程而非風格寬鬆度
- **Tester**（Sonnet）— 獨立稽核者：先從 spec 獨立列應驗行為清單（禁看測試檔防錨定）再對照補寫/修正測試；自動載入 `vitest` / `antfu` / `vue-testing-best-practices`，測試失敗會退回 Coder 修復（最多 3 輪；Coder 可引驗收依據原文申辯 test-defect，改派 Tester 修測試）
- **Reviewer**（Opus subagent）— 以 `opus-reviewer` plugin agent 派發（frontmatter 鎖 `model: opus` 與工具白名單、無 Write/Edit、報告首行自報實際 model），一次審完 code quality / 安全性 / 慣例 / spec alignment；改動觸及 `.vue` template/style 或純樣式檔時加載 `web-design-guidelines` 補 UI/a11y 檢查；安全敏感路徑或升級模式開啟後重派時自動升級為 adversarial prompt；FAIL 時退回對應 agent，WARNING re-check 降級為 Sonnet targeted check
- **操作流程驗證**（Sonnet subagent，觸及 UI/流程時）— 載入 `verify-flow` + claude-in-chrome，在真瀏覽器實際點擊走完 spec 設計的流程，只驗「流程走得完、不報錯（console error / 未預期 4xx-5xx）、不中斷」與 spec 明文寫出的元件（存在/可見/可互動）及位置（粗粒度）；不碰美感、間距、資料合理性——那些留給人。在 Reviewer 迴路 settle 後壓軸執行（驗的必是最終 code），FAIL（重現確認後）退回 Coder、修復走靜態關卡後再重驗；環境問題判 BLOCKED 問人、重現不出標 flaky 交人，皆不計 retry；作為 Phase 3 人工驗收的前置過濾器
- **註解整理**（Sonnet subagent）— 開發收尾 fresh-eyes 清除 AI 累積的過時/疊加/思考流程/冗餘註解，以「功能完成後、不知道開發過程的讀者」視角評估：凡讀命名／結構／鄰近檔案（如 CSS／型別）即可回推者皆視為冗餘（涵蓋語意複述，不限字面直譯），唯跨越開發期仍成立的「為什麼」、JSDoc 與功能型指令註解（`eslint-disable`、`@ts-expect-error` 等）保留；依守則直接套用 Edit 後重跑 lint + 測試作安全網（指令依專案 package manager / scripts 偵測，不寫死 `npx`）

### Spec 同步保證

- `/srn:feat` 自動更新 `openspec/changes/<name>/` 下的 design 與 tasks
- `/srn:fix` 在 commit 前比對 `openspec/specs/` 與專案 CLAUDE.md 定義的設計文件位置，確保 code 與 spec 不脫鉤

## Install

### 前置依賴

| 工具 | 用途 |
|------|------|
| [OpenSpec](https://github.com/Fission-AI/OpenSpec) | 產出/管理 `openspec/` 變更 artifact（建議；`/srn:feat` 需要變更目錄已存在） |
| [antfu/skills](https://github.com/antfu/skills) | 提供 `vue` / `vue-best-practices` / `nuxt` / `antfu` / `vitest` / `vue-testing-best-practices`（必裝） |

> 相容性：本 plugin 依賴 OpenSpec 的目錄約定（`openspec/changes/<name>/` ＋ proposal / design / tasks / specs）與 antfu/skills 的現行 skill 命名——皆為名字級依賴。外部 skill 缺裝或改名時，agent 會**停下回報**，不在無慣例約束下繼續寫（preflight 紀律）。

### 安裝本 plugin

```bash
/plugin marketplace add jay123578951/claude-sdd-kit
/plugin install srn@specrun
```

### 驗證

```bash
/plugin list                       # 應看到 srn@specrun
ls ~/.claude/skills                # 應有 vue / vue-best-practices / nuxt / antfu / vitest / vue-testing-best-practices
```

## 最小範例

```bash
/opsx:explore weather-monitor       # 探索需求（可選）
/srn:decisions weather-monitor     # 動手前收斂未定決策（決策分支多時，可選）
/opsx:propose weather-monitor       # 產出 proposal / design / tasks / specs

/srn:feat weather-monitor          # Coder → Tester → Reviewer 一氣呵成
```

跑完後人工驗收，最後 `/opsx:verify` → `/opsx:sync` → `/opsx:archive` → commit → merge。

## 專案慣例

UI 語言、設計系統、CSS 變數命名等專案特有慣例請寫在根目錄 `CLAUDE.md`，agent 派發前會自動讀取，並在 review 階段再次引用。

## Feedback

Bug 或建議請開 [GitHub Issues](https://github.com/jay123578951/claude-sdd-kit/issues)。

## License

MIT — 見 [LICENSE](LICENSE)。變更紀錄見 [CHANGELOG.md](CHANGELOG.md)。
