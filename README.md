# specrun

> 一個指令跑完開發 → 測試 → 審查的 SDD 工作流 Claude Code plugin。核心 pipeline 不挑技術棧；慣例知識拆成 stack pack 選裝，裝了 agent 自己會挑著用，沒裝也照樣跑。

## 這是什麼

**你開口的那一刻，該下的指令、該載的規範、該找的人，specrun 全接手，替你跑完一輪 SDD。**

- **入口** — 附一個開場 hook，替你判斷這句話該走哪條路。
- **流程** — 複雜項目走完整流程，小改動走輕量版，兩者的成本跟風險成正比。
- **品質** — 寫完交給拿不到作者思路的獨立審查把關。
- **回饋** — 跑偏的事件會被記錄、聚類，寫回。

## 入口引導

**最需要流程的時機，恰是你腦中沒有「輸入指令」意識的時刻。**

```mermaid
flowchart TD
    U["你開口"] --> J{"想做什麼？"}
    J -- "開發、提問、想討論" --> D["宣告一句<br/>帶你進規格討論"] --> P["產出規格<br/>→ /srun:feat"]
    J -- "很明確的小微調" --> E["直接改"]
    J -- "東西壞了" --> B["查完回報原因就停<br/>修不修由你決定"]
    J -- "查個資料、專案外雜事" --> S["直接回答"]
```

> 專案還沒接規格流程時，入口會改成問你想怎麼走。
>
> 有好幾題要問你時，一次只談一題：先講這題的建議和理由，等你回答再問下一題。

## 核心流程

```mermaid
flowchart LR
    A["/srun:feat"] --> Coder
    Coder["Coder<br/>Sonnet / Opus"] --> Tester["Tester<br/>Sonnet"]
    Tester -- "測試失敗退回" --> Coder
    Tester --> Reviewer["Reviewer<br/>Opus・獨立"]
    Reviewer -- "FAIL 退回" --> Coder
    Reviewer --> Full["全部測試<br/>主對話自跑"]
    Full -- "測試失敗退回" --> Coder
    Full --> Verify["操作流程驗證<br/>觸及 UI 時"]
    Verify -- "FAIL 退回" --> Coder
    Verify --> Gap["規格缺口回寫"]
```

> 每個角色都是獨立 subagent。失敗會自動退回上一關修，修好再往下走。每過一關，主對話會在對話寫一行這關的結果和下一關。派出 agent 後，再用兩行白話講現在做到哪、還剩哪幾關。tasks.md 裡「驗證畫面」「檢查完整性」這類 task 不會丟給 Coder 自己驗自己，等對應關卡過了自動幫你打勾。

## 五個設計重點

| 重點                            | 怎麼做                                                                                                        | 為什麼                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **預防勝於 retry**              | Coder 動手前先載入行為守則當地板；需求還沒收斂的，先進決策階段把細節問清楚再開工                              | 事後攔一次的代價是退回、重寫、整條 pipeline 重跑，遠高於動手前多問幾句。Reviewer 是安全網，不該當第一道防線                 |
| **Reviewer 看不到寫的人怎麼想** | Reviewer 是獨立 Opus subagent，只拿到 code 和 spec，拿不到 Coder 的推理過程，也聽不到他解釋「我為什麼這樣寫」 | 自己寫自己審，只會照著原本的思路找證據支持自己：會驗證，不會證偽。斷開 context 才是真正的第二雙眼睛，不是同一顆腦袋讀第二遍 |
| **模型動態切換**                | Coder 一般用 Sonnet；碰到架構變更、安全路徑、決策密集，起跑就用 Opus。同一件事修到第 2 次還沒過，只有修那件事的 agent 改派 Opus| 大部分改動不用 Opus，把錢花在刀口上                                                                                         |
| **改動要分級**                  | 對話已定案的小改動走輕量 pipeline，新功能才走完整 spec 流程；需求還沒收斂的，先進決策階段問清楚再動手         | 流程的成本要跟改動的風險成正比。小改動被完整 spec 綁住，你下次就繞過流程自己改了。流程一旦讓人想逃，它就失效了              |
| **主對話不爆 context**          | 每個角色都在自己的 subagent 裡幹活，只把結論回報主對話，過程的雜訊留在各自的 context                          | 主對話只累積結論、不累積過程，訊息不漏又不撞壓縮瓶頸，開發再長也不怕被截斷                                                  |

## 功能

### 指令

平常你只會下這兩個 — 它們會自動編排底下的角色：

| 指令                               | 什麼時候用                                                             | 做什麼                                                                                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **`/srun:feat`** `<change-name>`   | 新功能、大型重構、跨模組變更                                           | 跑完整 pipeline，搭配規格 artifact                                                                                                         |
| **`/srun:fix`**                    | 對話已定案、不需新 spec 的小改動（跨檔 bug、小 UI 調整、小型模組微調） | 輕量 pipeline：先判斷 spec 影響 → Coder（自寫測試）→ 安全 review（碰到安全敏感路徑才跑）→ 全部測試 → Spec 複核|

需求還有沒定的細節時，不用自己下指令：討論結束會跳選項，問你要不要先把這些細節一題一題問清楚（`srun:decisions`），問完再產出規格。

還有一個追蹤 kit 防錯規則的指令：**`/srun:retro`** `[--archive]` — feat/fix 完成時自動記下本次哪些防錯規則開了、開了之後那關過沒過，以及偏離事件，進跨專案收件匣；`--archive` 算各規則的開啟率與攔截率，過期的提拆除實驗、出事的提補強。

> **微調就別開 plugin 了** — CSS、文字、單行 fix 直接在主對話改最快。

### 流程內部跑什麼

`feat` / `fix` 跑起來，內部依序派發這幾關。每一關的判準、為什麼這樣定，見 [pipeline.md](pipeline.md)。

| 關卡 | model | 做什麼 | 什麼情況退回 |
| ---- | ----- | ------ | ------------ |
| **Coder** | Sonnet；架構／安全／決策密集起跑就用 Opus | 動手前載入 `guidelines` 行為守則，先讀會碰到的程式碼對照 tasks，再照 tasks 寫 code；完成自跑 lint + typecheck | 下游任一關 FAIL 都退回這裡 |
| **Tester** | Sonnet | 先照 spec 自列「該驗什麼」，這一步不看任何測試檔；列完才對照既有測試補寫。只跑相關測試 | 測試失敗退回，不算輪；談不攏或修不好交給 Reviewer 裁決 |
| **Reviewer** · `/srun:review` | Opus，獨立、無寫入權 | 一次審完 code quality／安全／慣例／spec 對齊 | FAIL 退回，第 2 輪起那一輪的修復改派 Opus，第 3 輪還不能判通過才問你；被指的一方可拿依據要求重審那一條 |
| **全部測試** | 主對話自做 | Reviewer 通過後跑一次全部測試；前面的 agent 都只跑相關測試 | 這次弄壞的退回，既有失敗實跑基準版本比對後列進報告；一個 run 只跑這一次，之後修 code 只跑相關測試，改到設定檔才再跑全部 |
| **操作流程驗證** · `/srun:verify-flow` | Sonnet，觸及 UI 時 | 真瀏覽器點完流程，驗走得完、不報錯、spec 明文寫的元件在不在 | FAIL 重現確認後退回 |
| **規格缺口回寫** | 主對話自做 | 把 Coder 撞到的 spec 未交代規則寫進 delta spec，逐條列給你 | 不退回，驗收時你逐條決定收不收 |

> **操作流程驗證會自己起一個驗證用的 dev server。** 起法記在 `openspec/config.yaml`：port、啟動指令、要帶的環境變數、怎麼登入。檔案裡沒記時，流程起成功後會把實際用的起法寫回去。碰到登入頁時，流程會停下來請你在驗證用的瀏覽器視窗登入，不會跟你要帳密。
>
> **流程的暫存檔放在專案的 `.claude/debug/`。** 這個資料夾自己帶 `.gitignore`，不會進版控，跑完會清掉。

### 跑完會看到什麼

流程跑完會給一份完成報告。開頭一行講結果：改了幾個檔、退回修過幾輪。底下各段有內容才出現：

| 段落 | 裡面是什麼 |
| ---- | ---------- |
| **AI 自行裁決** | AI 自己下的判斷，你知道後可能會要它改回來。例如 tasks 對現況寫錯、Coder 改正後繼續做的地方，Reviewer 裁決的異議，這次決定不修的問題 |
| **規格缺口** | spec 沒交代、AI 替你決定的規則，已經寫進 delta spec。不接受的說一聲，流程會改程式並刪掉那一條 |
| **既有失敗** | 開工前就失敗的測試。不是這次弄壞的，沒有修 |
| **要你親手驗的** | 自動驗不了的項目：瀏覽器工具做不到的操作、只出現一次重現不出來的錯誤、純視覺的改動 |
| **沒把握的註解** | Coder 寫了但不確定該不該留的註解，留不留由你決定 |
| **順手看到的** | 跟這次無關的死碼、可疑邏輯。只回報，不處理 |

`feat` 的報告之後會跳驗收選項：

- **驗收通過，跑收尾**：接著跑 `/opsx:sync` → `/opsx:archive`
- **評估順手看到的項目**：報告有「順手看到的」才出現。主對話逐項讀相關程式碼，回報建議修或不修，等你決定
- **有地方要改**：你說哪裡不對，規格層的問題先改 spec，實作層的小問題走 `/srun:fix`
- **還沒驗完，晚點再說**：不做任何事，等你回來

`fix` 的報告之後不跳選項，後續由你接著說。

### 流程進行中會擋下的指令

`feat`／`fix` 跑完前不 commit，工作目錄上一直有還沒 commit 的改動。流程進行中，srun 會直接拒絕下面兩類指令。拒絕訊息會告訴下指令的那一方改用什麼方法，流程不會停下來等你。

| 擋什麼 | 擋誰 |
| ------ | ---- |
| 會丟掉未 commit 改動的 git 指令：`stash`、`restore`、`checkout` 還原檔案、`reset --hard`、`clean -f` | subagent 任何時候都擋。主對話只在 `feat`／`fix` 進行中擋 |
| 用 `rm`、`find -delete` 刪 Git 救不回來的檔：被 gitignore 的檔、開工前就在的未追蹤檔或未 commit 改動 | `feat`／`fix` 進行中的 subagent。這次 run 新建的檔照常可刪 |

流程進行中要比對開工前的版本，改用 `git worktree` 另開一個目錄，或用 `git diff`、`git show` 讀。

## 周邊工具

> 不在 pipeline 上，也不用你下指令。裝了 `srun` 就有，要不要用每個專案自己決定。

### 開發項追蹤（Beta） · `srun:roadmap`

一個大功能要分好幾次做的時候，怎麼切、先做哪段、動手前要注意什麼，這些在第一個 change 開出來之前有地方放。

- **一項一檔**，放在 `openspec/roadmap/`。有沒有這個目錄就是開關，不想用的專案問過一次就不再問
- **它會自己消失**：開 change 時筆記搬進 `design.md`，整項做完檔案直接刪掉，不會愈長愈大

### 註解整理 · `srun:comment`

對人寫的舊 code、別人的 branch 手動跑：讀 code 本身就看得懂的一律當冗餘刪掉。只留過了開發期還成立的「為什麼」、JSDoc 和功能型指令（`eslint-disable` 這類有前後計數盯著，不怕誤刪）。

## 安裝

### 0. 前置依賴

| 工具                                                        | 必裝 | 用途                                                    |
| ------------------------------------------------------------ | ------ | ------------------------------------------------------- |
| **[OpenSpec CLI](https://github.com/Fission-AI/OpenSpec)**  | 是    | 把「這次要改什麼」寫成規格與任務清單。整套流程的引擎，`/opsx:*` 指令都靠它 |
| [Node.js](https://nodejs.org/)（含 npm）                    | 是    | srun 隨附的腳本用它跑：算這次改了哪些檔、啟動驗證用的瀏覽器工具。裝 OpenSpec CLI 也要用到 npm |
| [specrun 桌面 App](https://github.com/jay123578951/specrun-app) | 否    | 看規格的桌面畫面，讀的是 OpenSpec CLI 寫出來的同一批檔案。不裝就用文字編輯器看，流程不受影響 |
| [Google Chrome](https://www.google.com/chrome/)             | 否    | 操作流程驗證（verify-flow）實際開的瀏覽器。srun 隨附的 playwright MCP 走系統 Chrome，不用另裝 Playwright 的 Chromium；MCP 套件本身第一次啟動會自動裝進 plugin 資料目錄，之後啟動不上網。沒有 Chrome 的話該關會跳過、退回人工驗證，不擋交付 |

裝 OpenSpec CLI：

```bash
npm install -g @fission-ai/openspec@latest   # pnpm / yarn / bun / nix 見它的 README
```

在專案裡跑一次 `openspec init` 建出 `openspec/` 目錄，`srun` 開場就會認出這個專案走規格流程。

<p align="center"><img src=".github/assets/specrun-app-icon.png" width="104" alt=""></p>

**[specrun 桌面 App](https://github.com/jay123578951/specrun-app)**（與這包 kit 同名，是另一個獨立的 repo）把 `openspec/` 目錄裡的變更清單、規格與任務攤成一個桌面畫面，省得一路 `cd` 進去翻 markdown。引擎完全是 OpenSpec CLI，它只負責顯示，兩邊看到的是同一份檔案。

限 **Apple 晶片的 Mac**。Intel Mac 下載後點開會說「無法在這台 Mac 上開啟」。

到 [Releases](https://github.com/jay123578951/specrun-app/releases) 下載安裝後，記得補跑這一行，否則第一次開啟會被 macOS 擋下來說它「已損毀」：

```bash
xattr -d com.apple.quarantine /Applications/specrun.app
```

### 1. 裝 plugin

裝 `srun` 本體＋自己技術棧的 stack pack，知識型 skills 由 pack 的依賴自動連帶安裝。從下表挑一列，代進四行指令：

| 技術棧              | `{pack}`            | `{skills 來源}`                                            |
| ------------------- | ------------------- | ---------------------------------------------------------- |
| Vue / Nuxt          | `srun-stack-vue`    | `jay123578951/antfu-skills`                                |
| .NET / ASP.NET Core | `srun-stack-dotnet` | `dotnet/skills`（官方；`backend-common` 隨本 marketplace） |

```bash
/plugin marketplace add jay123578951/specrun   # srun 本體
/plugin marketplace add {skills 來源}          # 該 pack 的知識型 skills 來源
/plugin install srun@specrun                   # 核心 pipeline，跟技術棧無關
/plugin install {pack}@specrun                 # stack pack，依賴自動連帶安裝
```

> 你的技術棧還沒有對應的 stack pack？只跑第一、三行也照樣用：agent 挑不到合用的知識 skill，就靠專案 CLAUDE.md 的慣例動手。

### 2. 驗證

```bash
/plugin list   # 應看到 srun@specrun、你裝的 stack pack，及自動連帶安裝的依賴
```

## 最小範例

```bash
/opsx:explore dark-mode       # 討論設計（可選）
/opsx:propose dark-mode       # 產出 proposal / design / tasks / specs

/srun:feat dark-mode          # Coder → Tester → Reviewer → 全部測試 → 操作流程驗證，一次跑完
```

跑完人工驗收，最後 `/opsx:sync` → `/opsx:archive` → commit → merge。

## 專案慣例

UI 語言、設計系統、CSS 變數命名等專案特有慣例，寫在根目錄 `CLAUDE.md`。agent 派發前會自動讀，review 階段再引用一次。

## Feedback

Bug 或建議請開 [GitHub Issues](https://github.com/jay123578951/specrun/issues)。

## License

MIT — 見 [LICENSE](LICENSE)。變更紀錄見 [CHANGELOG.md](CHANGELOG.md)。
