# Changelog

## 0.20.0 — 2026-07-13

t-cert Google Font 案驅動的提問入口翻轉。實錘：使用者質疑進行中 change（dashboard-overview）design.md 的兩項決策（「為什麼用 Google Font」「離線是不是過度設計」），被 0.19.0 規則 8 分類為純問答——唯讀調查答得很好，但「字型該刪」「離線是半套」這些 spec 層結論無處可落、等 /clear 蒸發。收斂關鍵：「是不是開發專案」不用逐句判斷，有規格後端＝開發專案是 hook 已偵測的環境事實（專案內開 session 九成以上綁定專案，基率直接寫成預設值）；訊息層只剩一個看得見的判斷——問題類型豁免，動機不猜（動機看不見，猜就會錯；動機若是開發，動手邊界重判兜底，豁免判錯的代價是晚點進場不是永遠漏接）。

### Changed

- **提問預設進場**（`scripts/intent-guidance.sh`、`docs/intent-guidance-adapter.md`）：專案相關話題——開發、修改、提問、評估、討論——一律預設宣告進規格討論流程，不再限「開發／修改意圖」；質疑既有設計決策的疑問句（「為什麼這樣做」「是不是過度設計」）與「幫我評估」語意等價，歸討論不歸診斷，診斷軌收窄為「故障查根因」。判斷點從動手邊界單點變為「話題入口＋動手邊界」兩單點，頻率紀律補「同話題延續不重判、不因聊得久重判」。
- **豁免統一為雙白名單**（同上兩檔）：規則 3 併列直改豁免（三錨，沿用）與直答豁免（看問題類型、不猜動機：①純知識／事實查詢，spectra 可順路提 `/spectra-ask`②專案外雜務——求產出不求立場）；高信心才豁免、不確定就進場，與三錨的「『感覺很單純』不是錨」同一哲學。

### Removed

- **規則 8「純討論靜默」整條刪除**（`scripts/intent-guidance.sh`）：職責由直答豁免接手，靜默僅剩流程內部與無後端降級（none 後端無 discuss 可進，提問照常直答，降級行為不變）。錯誤成本不對稱同 0.19.0 宣告制：誤入 discuss＝一句宣告（discuss 唯讀）；漏接＝spec 層結論蒸發。

## 0.19.0 — 2026-07-13

首次 `/srun:retro --archive` 歸檔消化（收件匣 6 筆：2 feat＋1 fix＋3 guidance 對照實驗）驅動的改版。三筆 t-cert 引導對照實驗的核心發現：其一，discuss 唯讀、誤入成本近零，誤直改成本不可逆（匯出案落地了 discuss 對照組明確否決的方案）——錯誤成本不對稱，入口預設應倒向 fail-safe 側；其二，三件漏接全發生在「跳選項」之前的分類層（自判豁免、問在修法層、誤套驗收行），把體驗押在每次分類正確的選項制上，比押在粗但穩的預設上更脆；其三，調查品質的決定變數是有無 change context 而非走不走 discuss（有：查詞彙表、跨模組慣例比對；無：重新發明詞彙、單模組收斂）。據此把入口從選項制改為宣告制。SPECTRA／openspec 均為外部凍結件——change 掃描落在引導層、借力 spectra-discuss 既有的帶 name 載入條件句，兩後端零改動。

### Changed

- **入口意圖引導層改宣告制**（`scripts/intent-guidance.sh`、`docs/intent-guidance-adapter.md`）：開發／修改意圖（含求建議、求評估的開發話題）預設宣告一句進規格討論流程（spectra: `/spectra-discuss`；openspec: `/opsx:explore`），不跳選項、不徵求同意，宣告尾帶「要我直接動手就說一聲」當 escape hatch；AskUserQuestion 降為兜底（真模糊、多 change 歸屬、流程中段既有岔路）。動手邊界補「調查完才想動手＝回入口重判，勿套驗收交界」（上傳案誤套驗收行實錘）。none 後端無討論流程可進，維持降級選項制。
- **直改豁免收斂為三錨白名單**（同上兩檔）：①祈使句式 ②標的明確到檔案／元件 ③不刪不換既有結構（刪 class／結構體系、置換視覺語意、對齊到另一套設計都不算微調）——符合才豁免，取代原「單行修改、純樣式微調永不觸發」的 AI 自由心證豁免（KPI 案實錘：刪整套 pr-kpi class 體系被自標「純樣式對齊」）。

### Changed（機考回饋修正）

- **規則 2 補「不就地代辦」**（`scripts/intent-guidance.sh`）：宣告後即執行流程指令，不在對話中就地代辦 discuss／decisions 的內容——19 題 sonnet headless 機考（13 PASS／3 EDGE／2 FAIL、越線動手 0 件）中五題未過的共同病灶即「流程代辦」：安全紀律滿分（零改動、有停下問授權），但把該進流程做的事在對話裡就地做完。
- **規則 5 補中段表態優先級**（同上檔）：討論進行中的方案表態不重新觸發規則 2——進不進流程在意圖首次浮現時已判過，中段只確認要不要開始。機考 #04 暴露規則 2/5 對「我比較偏向 X」句式各有主張（考生依規則 2 宣告進 discuss、考卷預期依規則 5 問「要開始了嗎」），裁決規則 5 優先：對話開頭已決定過進不進流程，中段不需再問一次。

### Added

- **進場前 change 掃描**（`scripts/intent-guidance.sh`）：進規格討論流程前先列進行中 change（spectra: `spectra list`；openspec: `ls openspec/changes/`）——零個＝新題目直接進；唯一且與話題吻合＝帶名進場（spectra 帶參數、openspec 寫進話題）；多個或不確定＝跳選項一次。吻合判斷只到 change 名層級，入口保持輕；「追加既有 change vs 開新 change」是 discuss 的產出、不在進場時拍板。三案對照實錘：context 載入需求在流程開頭，而規格後端的歸屬詢問在流程末端。
- **Tester 守則補 settle 前 lint 自查**（`skills/feat/references/tester-conventions.md`）：對自己新增／修改的測試檔跑 scoped lint（per-file，避開 pre-existing 噪音），紅燈自修後才交付——對齊 Coder 既有紀律（EOC_TV 案：Tester 產出的測試檔帶 2 個 unused-vars 出廠，comment 整理階段才被抓到）。
- **Tester 守則補量詞 fixture 條文**（同上檔）：spec 條文帶量詞（每個／全部／各自）時，fixture 至少含複數個體、且對每個個體斷言——單元素 fixture 對「只有首則」與「每一則」兩種實作輸出相同，數學上不可區分（EOC_TV 案：「each reporting step content」CRITICAL 溜過 Tester，因既有測試僅單 step fixture）。先驗普遍盲點（LLM 寫測試偏好最小 fixture），非單案特例。
- **retro 事件表 `guidance_*` 對齊宣告制**（`skills/retro/SKILL.md`）：`guidance_miss` 補「該進流程卻就地處理」形態；`guidance_false_trigger` 改以「escape hatch 被撤回」為行為實錘（並註明撤回率是誤觸發下界——容忍型不撤回、量不到）；`guidance_hit` 記錄去向含帶入的 change 名（宣告制成敗繫於 change 掃描準確率，掛錯 change 比誤入更有害），掛錯 change 先記 observations、再犯升格。不改則收集工具講選項制舊語言，0.19.0 成效無法量測。

## 0.18.0 — 2026-07-12

對照外部 kit（multica-ai/andrej-karpathy-skills，Karpathy 四原則濃縮版 CLAUDE.md）逐條評估後，結論是其三原則（Simplicity First／Surgical Changes／Goal-Driven）均為 `guidelines` 既有超集，Think Before Coding 的「問人」模式已由 `/srun:decisions`（pipeline 層）＋自主判斷邊界（agent 層）分層承接，不採納。唯二 delta：其一，「發現無關死碼 → mention it, don't delete it」——`guidelines` §3 只說不要刪，資訊被允許靜默蒸發，與 §1「關鍵假設不靜默吞掉」精神矛盾，本版採納；其二，bug 修復的紅綠驗證（先寫重現測試確認紅燈再修——現行 Coder 修完 Tester 才補測試，測試出生即綠、從未證明抓得到原 bug）為實質缺口，**本版未採納、另案評估**（落點在 Coder 端 test-first 或 Tester 端 revert 驗紅，成本取捨未定）。

### Added

- **`guidelines` §3 新增「順手觀察：回報不動手」**（`skills/guidelines/SKILL.md`）：在本次實際觸碰／閱讀的檔案裡撞見無關死碼／可疑邏輯／過時註解時，寫進輸出的「順手觀察」段（選填）——一行一項、註明位置、不附修法（附了就是誘惑下一步順手動工）。邊界從嚴：僅限路過看到的，不准為了填這段掃無關檔案；定位是給人的情報不是待辦，不觸發任何後續派發。
- **feat／fix Coder 輸出新增「順手觀察」選填項，完成報告原樣透傳**（`skills/feat/SKILL.md`、`skills/fix/SKILL.md`、`docs/ai-development-pipeline.md`）：復用設計決策摘要既有的 Coder → orchestrator 出口，不新增通道；orchestrator 把觀察原樣帶進完成報告交人判斷，明文不觸發 retry 或派發（與 verify-flow flaky 標註同款「標註交人」形狀）。

## 0.17.0 — 2026-07-12

對照外部 kit（DietrichGebert/ponytail）評估後，採納三項機制補 `guidelines` 的洞：其一，最小可行段只有原則式敘述，缺一個有順序、可停下的決策程序，且完全沒有依賴紀律——「新增依賴前先查 stdlib／平台原生／已裝依賴」這個 LLM 高頻通病無條文可管；其二，守則只往「砍到最小」單向推，沒有反向地板，存在 Coder 為了 diff 最小而砍掉輸入驗證／錯誤處理的風險；其三，七階梯把 Coder 更用力推向最小後，「刻意捷徑靜默轉正」風險升高，而捷徑的唯一去處（設計決策摘要）pipeline 結束即蒸發——採納債務註記慣例作配重，但**只做慣例不做回收命令**（回收命令是為未量測的問題建機制；等 `grep TODO(debt)` 顯示標記實際累積再議）。另採納其對照組 benchmark 的方法論精神進 retro 歸檔：提案必答「最便宜等效替代」。複雜度標籤 taxonomy 不照抄五標籤，改以七階梯編號讓 review 端與生成端同語彙。強度模式切換、多平台 adapter 決議不做。

### Added

- **`guidelines` §2 新增債務註記慣例**（`skills/guidelines/SKILL.md`）：刻意選較小做法且自知有天花板時，現場留 `TODO(debt): <簡化了什麼>。上限：<規模／情境>。升級條件：<何時該還>`——三要素缺一不可（沒上限無法判斷風險、沒觸發條件即永久延遲）；僅限有天花板疑慮的取捨，日常七階梯決策不留。固定前綴使債務可 `grep` 盤點，也讓日後 review 掃到最小實作時能識別「有記錄的取捨」而非漏做，減少誤判 finding 進申辯通道。
- **`comment` 保護清單新增 `TODO(debt)`**（`skills/comment/SKILL.md`）：明列一律保留並納入保護清單前後計數（同 build-time pragma——誤刪測試驗不到）；註記是否已還清歸 Coder 的 code 層決策，不歸註解整理。
- **`retro` 歸檔提案新增「最便宜等效替代」檢核**（`skills/retro/SKILL.md`）：每條 kit 優化提案必答「有沒有更便宜的修法達到同等效果（一句條文 vs 一段規範 vs 新機制）」，答不出為何便宜版不夠的提案不成立——接在歸因分類之後的第二道防肥關卡，方法論源自 ponytail benchmark 的廉價對照組設計（完整 skill 必須贏過一行 prompt 才算數）。
- **`review` 過度設計 finding 對齊七階梯**（`skills/review/SKILL.md`）：過度設計類 finding 標註違反第幾階（階梯序內嵌模板——reviewer 不載入 guidelines），讓 finding→修復→申辯迴路與生成端守則共用語彙；並教 Reviewer 識別 `TODO(debt):` 註記——帶合格註記的最小實作是有記錄的取捨，不立 finding，除非升級條件已兌現。

### Changed

- **`guidelines` §2 最小可行實作改為七階梯決策程序**（`skills/guidelines/SKILL.md`）：動手前依序檢查「需要存在→codebase 已有→標準庫→平台原生→已裝依賴→一行解→最小實作」，停在第一個成立的階梯；新增依賴為最後手段，spec/design 沒指名的新依賴必須在設計決策摘要說明為何前四階不夠。原「不要／要」清單內容併入階梯與「寫最小實作時」小節，無條文刪減。
- **`guidelines` §2 新增「最小化的底線」清單**：信任邊界輸入驗證、防資料遺失的錯誤處理、安全措施、無障礙基本項——永遠不准為了 diff 小而省。

## 0.16.0 — 2026-07-12

對照外部 pipeline kit（hanamizuki/solopreneur）逐項評估後，採納兩項機制補洞：其一，retro 歸檔缺「模式 → 修法」的對應規範——所有聚類模式都反射性地「加一段條文」，會讓 kit 越修越肥、執行漂移越修越糟；其二，review finding 沒有對稱於 test-defect 的異議出口——修復 agent 遇到誤判 finding 只能照修或吃 retry counter，迴路可能被固執的 finding 卡死。同場評估的 spec 層對抗審查（需自訂 spectra workflow schema）與 context7 查核紀律均決議不做。

### Added

- **review-finding 申辯通道**（`skills/feat/SKILL.md`）：修復 agent（Coder 或 Tester）認為被指派修復的 finding 不成立時，可引依據原文申辯 review-defect（spec 段落／CLAUDE.md 條文，或誤讀處的檔案:行號與實際行為；引不出依據不受理）。受理後重派 Opus Reviewer targeted 仲裁——只裁該 finding、判維持／撤回、不計 Reviewer retry counter；維持而修復 agent 仍有異議 → 停下來問人。CRITICAL 與 WARNING 皆適用；申辯輪照計輪防拖延。Tier 2（fix）維持無申辯通道，與 test-defect 同款分級。
- **retro 事件表新增 `review_defect`**（`skills/retro/SKILL.md`）：記上訴結果（finding 撤回／維持／升級問人），累積通道使用率與撤回率數據供日後調校。
- **retro 歸檔模式新增歸因分類步驟**（`skills/retro/SKILL.md`）：聚類出的模式先歸因再開修法——條文不清 → 重寫該段；條文缺席 → 新增條文或事件；執行漂移 → 先查條文結構（過長／關鍵句被埋沒），同處反覆漂移才升 hook 等機制層；一次性失誤 → 不動 kit。

### Changed

- `docs/ai-development-pipeline.md` 同步申辯通道：Phase 2 管線圖 Reviewer 區塊、失敗處理策略的 Review FAIL 與 PASS with WARNING 分支；版本 0.15.1 → 0.16.0。

## 0.15.1 — 2026-07-11

入口引導層 v1 的實測記錄通道。動機：v1 唯一驗收指標是「漏接率」，但引導漏接與誤觸發多發生在**未進 pipeline 的 session**（純討論、診斷、被越線的對話），retro 既有的 feat/fix 完成觸發點看不到它們——只靠自動記錄，量到的漏接率會系統性偏低。本版把記錄通道補上，不建自動偵測機制（為未量測的問題建機制正是 kit 在批的病），dogfood 階段靠事發當下手動補記。

### Added

- **retro 事件表新增三個引導型別**（`skills/retro/SKILL.md`）：`guidance_miss`（漏接：意圖浮現未宣告／未跳選項／越線動手）、`guidance_false_trigger`（誤觸發：Tier 1 被跳選項、純討論被逼問）、`guidance_hit`（命中——漏接率的分母）。通道差異明寫進 skill：miss／false_trigger 主通道為手動補記；hit 引導進線 pipeline 時由完成報告順帶記。
- **條目格式支援非 pipeline 補記**：`tier` 增列 `"guidance"`，此類條目 `stats` 省略、`subject` 記當時對話主題。

### Changed

- 實測方法的記錄通道就此定案（同步記於維護者內部決策 doc），殘留樣本量與判定標準；版本 0.15.0 → 0.15.1。

## 0.15.0 — 2026-07-11

入口意圖引導層 v1。動機：紀律是 opt-in 的——最需要流程的時刻，恰是使用者腦中沒有「我要開發」意識、不會想到打指令的時刻；意圖模糊時 AI 用預設（行動）填補，造成「只想討論／診斷卻被動了 code」的越線。本版把 kit 的路由判斷力送到入口與岔路口：引導制、無任何強制層。收斂過程、措辭定稿與事實查證記錄於維護者內部決策 doc（不隨 repo 發佈）；入口考卷 15 題，已以實際注入文本真考可考的 10 題——首考 8/10，「幫我處理一下」誤讀為修復授權，規則 3 補「模糊委託」句式後復考通過；漏接率與其餘 5 題實測待 dogfood。

### Added

- **SessionStart hook**（`hooks/hooks.json` ＋ `scripts/intent-guidance.sh`）：注入六條引導規則——動手邊界單點判斷、意圖清楚宣告後照做、模糊跳 AskUserQuestion 選項（說意圖不說指令名）、診斷結論即停點（「偏向做 X」非動工授權）、診斷臨時 log 紀律（唯讀流程宣告暫出）、頻率紀律與純討論靜默。matcher 不設限＝ startup／resume／clear／compact 四開，compact 後重灌規則緩解長 session 衰減。
- **後端偵測與適配**：腳本確定性偵測（CLAUDE.md 的 `SPECTRA:START` 標記 → spectra；`openspec/` → openspec CLI；皆無 → 入口降級為「初始化／直改／診斷／討論」），只注入已解析後端的交界圖——入口與交界 1、4b 為岔路跳選項，直路只宣告，pipeline 內部靜默。適配表維護對照見 `plugins/srun/docs/intent-guidance-adapter.md`。
- **實測背書**（記錄於決策 doc L 節）：SessionStart 對 subagent 不觸發、注入內容不進 subagent context（本機實驗定案）——pipeline 的 Coder 讀不到引導規則，「hook 攔到自家 subagent」的打架問題不存在。

### Changed

- plugin／marketplace description 補 SessionStart intent-guidance hook 一項；版本 0.14.0 → 0.15.0。

plugin 命名空間 `srn` → **`srun`**。動機是直覺性：`srn` 三個子音連寫唸不出來、也丟失了專案名 `specrun` 的記憶點「run」；`srun` 可直接唸成 spec-run 的縮音、打字手感更順，語意連回專案名。與 Slurm 內建 `srun` 的撞名僅屬理論——此處是 slash command 命名空間（`/srun:`）而非 shell 指令，受眾為前端 SDD pipeline 不碰 HPC。本次僅改 plugin 名，marketplace 名（＝ GitHub repo 名）維持 `specrun`，不涉及 repo 改名。

### Changed（破壞性——指令名稱變更）

- **斜線指令前綴 `srn:` → `srun:`**：`/srn:feat` → `/srun:feat`，其餘 fix／review／comment／verify-flow／retro／decisions 同理。安裝後需以新前綴呼叫。
- **內部 skill 載入限定名同步**：feat／fix／decisions 的操作型載入指示一律 `srun:review`／`srun:comment`／`srun:guidelines`／`srun:verify-flow` 等。
- **plugin 目錄改名**：`plugins/srn/` → `plugins/srun/`，`marketplace.json` 的 `source`、`scripts/sync-descriptions.mjs` 讀取路徑、plugin.json／marketplace description 同步更新。
- **安裝識別碼變更**：`/plugin install srn@specrun` → `/plugin install srun@specrun`。`marketplace add jay123578951/specrun` 與 repo 不變（marketplace 名仍為 `specrun`）；`/plugin list` 應看到 `srun@specrun`。

## 0.13.0 — 2026-07-06

antfu/skills 上游同步後，將兩個新 skill 接進 pipeline 的自動載入邏輯。動機是這兩個 skill 直接對應本 kit 的 Vue/Nuxt 定位缺口：`nitro` 補齊 Nuxt server 引擎面（原本 Coder 碰 `server/` 只有 `nuxt` 的框架整合視角，缺 route rules／快取層／event handler 的引擎細節），`antfu-design` 補齊 UnoCSS 的設計慣例面（原本 `unocss` 只管 rule 語法，缺 semantic token／雙主題／anti-slop 的設計判準）。

### Added

- **Coder 預判表新增 `nitro`、`antfu-design` 兩條偵測規則**（`skills/feat/references/coder-skills-map.md`，feat／fix 共用）：
  - 涉及 Nuxt/Nitro server 端（`server/` API routes／event handlers、`nitro.config`、`routeRules`、server 快取、tasks／websocket、部署 preset）→ 自動載 `nitro`。
  - 涉及以 UnoCSS 建構／重構 UI（semantic token、雙 light/dark 主題、視覺樣式、micro-interaction）→ 自動載 `antfu-design`。
- **Reviewer 端同步追加規則**（`skills/feat/SKILL.md`）：改動觸及 UnoCSS UI 時追加 `antfu-design`（設計慣例／token 遵循），觸及 server 端時追加 `nitro`（route rules／快取／event handler 慣例），與既有 `web-design-guidelines`（a11y／UX）互補。

### Changed

- `feat`／`fix` skill 表格「可選 Skills」欄與 `docs/ai-development-pipeline.md` 的 Coder 清單、Reviewer 觸發、Conditional skills 偵測方式三處同步鏡射，保持單一來源一致。
- 規則內明寫分工邊界避免與既有 skill 重疊：`unocss` 管 rule 語法／`antfu-design` 管設計慣例與 token 命名；`nuxt` 管框架整合面／`nitro` 補 server 引擎細節。
- **README 外部 skill 依賴同步**：原本前置依賴只列 6 個必載 skill 且缺安裝指令，補上 `#### 安裝外部 skills` 區塊——明列 `pnpx skills add antfu/skills --skill='*' -g`、點破「`antfu` 只是集合裡的一個 skill 不等於全部」、並將依賴拆成「必載 6 個」與「條件式追加 10 個」（含 `nitro`、`antfu-design`）兩層完整列出；驗證指令的 `ls ~/.claude/skills` 預期清單同步補上條件式 skill。修正條件式那層在文件中不存在、使用者只裝 6 個導致條件式受益靜默落空的缺口。

## 0.12.0 — 2026-07-06

專案改名 `claude-sdd-kit` → **specrun**、plugin 命名空間 `code` → **srn**。動機是命名撞名與冗餘：舊 skill `code-review` 與 Claude Code 內建 bundled skill `/code-review` 同名，而 kit 內部一律以裸名稱透過 Skill tool 載入，orchestrator 有解析到內建版、靜默替換 review 規範的正確性風險（稽核報告 P1）；同時 `commands/` 包裝層與 skills 雙重註冊，造成 `/code:feat`＋`/code:code-feat` 雙入口與 description 雙倍常駐 context（P2）。改名一次收斂兩者。

### Changed（破壞性——指令名稱變更）

- **斜線指令前綴 `code:` → `srn:`**：`/code:feat` → `/srn:feat`，其餘 fix／review／comment／verify-flow／retro／decisions 同理。安裝後需以新前綴呼叫。
- **移除 `commands/` 包裝層（P2）**：7 個 command 檔刪除，skill 直接作為斜線指令（官方已將 command 併入 skill）。`argument-hint` 由 command 搬入對應 skill frontmatter；skill 目錄去 `code-` 前綴（`code-feat/` → `feat/`），命名空間 `srn:` 已足以與內建及外部 skill 區隔，前綴屬冗餘。
- **內部 skill 載入改用限定名（P1）**：feat／fix 的操作型載入指示一律 `srn:review`／`srn:comment`／`srn:guidelines` 等,杜絕撞內建 `/code-review`；外部 skill（vue／antfu／vitest…）維持裸名（個人層、無命名空間）。純敘述性提及維持裸短名。
- **安裝識別碼變更**：`/plugin install code@claude-sdd-kit` → `/plugin install srn@specrun`。GitHub repo 已改名（`claude-sdd-kit` → `specrun`），`marketplace add jay123578951/specrun`、plugin.json homepage/repository、README 連結同步更新。
- **回饋收件匣路徑正名**：`~/.claude/sdd-kit-feedback/` → `~/.claude/specrun-feedback/`（retro skill 收件匣與歸檔檔）。原路徑無累積資料，屬乾淨正名。

### Changed（invocation control——P3）

- `guidelines` 加 `user-invocable: false`：純背景行為守則，只被 Coder subagent 以 Skill tool 載入，從 `/` 選單隱藏（description 仍常駐 context 供載入）。
- `feat`／`fix` **維持 model-invocable**（不上 `disable-model-invocation`）：保留自主優先哲學下的自動 tier 路由能力；副作用由 pipeline 內建 phase gate 與 spec-first 前提條款把關。

### Changed（P4／P7 順手收斂）

- 跨 skill 引用改用 `${CLAUDE_SKILL_DIR}/../feat/references/…` 基底，消除 cwd 依賴。
- `argument-hint` 與 `$ARGUMENTS` 收斂進 skill 層（command 移除後的自然歸位）。
- `sync-descriptions.mjs` 收斂為純版號一致性檢查（command 生成同步已無對象）。

### Notes

- CHANGELOG 舊條目維持原名不動（歷史紀錄，改名等於竄改）。
- 本次不改任何 gate 順序、停損上限、STOP 條款、model 策略與交付流程；純命名／結構重構。

## 0.11.0 — 2026-07-04

Skill 減重版。依「skill 條文只寫給執行期 AI」與 SSOT 原則全面去重：設計論證出文、規範副本收斂、reference 檔漸進揭露；唯一行為變更是 retry 升級規則收斂為全 pipeline 單一開關。八個 skill 全數落在 SKILL.md 500 行建議值內（最大 334 行）。

### Changed（行為變更——升級模式）

- **Retry 動態升級收斂為全 pipeline 單一開關**（取代 0.10.0 的「同一迴路 counter ≥ 2 分帳」）：任一 gate 進入第 2 輪修復即開啟**升級模式**——此後所有修復派發一律升 Opus（綁派發不綁角色）、Opus Reviewer 重派一律帶 adversarial、免重讀限制解除；開啟後不關閉。理由：升級訊號出現後多花的 Opus 呼叫是便宜貨幣，逐迴路記帳的複雜度才是永久 drift 面——orchestrator 只需維護一個布林狀態。targeted re-check／re-run 是驗證派發，維持 Sonnet 不受影響。
- **輪數累計規則推廣至所有 gate**：「同 Pipeline 內累計、不因修復成功重置」原僅明文於 Reviewer 迴路，其他迴路未定義；統一為所有 gate 適用（收斂原有歧義）。各 gate 3 輪停損、不計輪清單（就地自修／BLOCKED／flaky／targeted 驗證派發）皆不變。
- 同步位置：`code-feat`（Retry 迴路、Model 表）、`code-fix`（Model 策略、Retry 迴路）、`code-review`（adversarial 觸發條件）、pipeline doc（流程圖、Model 升級條件、Adversarial 升級）、README。`code-retro` 的 `counter_2`／`counter_3` 為收件匣 JSONL 固定詞彙不改名，語義在升級模式下仍成立（第 2 輪＝升級、第 3 輪＝停損）。

### Changed（文件結構——執行契約不變）

- **code-feat 減重（508 → 334 行）**：刪除條文內嵌的說服性論證與維護者導向說明（論證已存於 CHANGELOG 與決策記錄，維護時走 git blame 溯源）；Retry 迴路六小節收斂為「通用規格＋各 gate 差異表＋test-defect 申辯通道」，操作規則全數保留；Guardrails 只留獨有不變量，砍複述正文的條目。
- **feat／fix 共用段落抽 reference 檔（SSOT＋漸進揭露）**：新增 `code-feat/references/` 三檔——`coder-skills-map.md`（額外 skills 預判表，orchestrator 派發前讀）、`tester-conventions.md`（Tester 測試守則，orchestrator 注入絕對路徑、subagent 開工前必讀，讀不到即停下回報）、`blocked-report.md`（阻塞輸出模板，宣告阻塞時才讀）。code-fix 以相對路徑引用，共用檔以 Tier 3 目錄為權威所在；各 tier 特有段（feat 防錨定工作順序、fix spec 驗收依據注入）留在各自檔內。code-fix 357 → 287 行。
- **code-verify-flow 檔內去重（263 → 171 行）**：本體「判準精神」「灰色地帶」「前置檢查與擋路情境」三節與 Subagent Prompt 模板逐字重複——刪除本體版，模板為單一來源；「工具未就緒＝優雅退化」的呼叫方語義併入 verdict 表 BLOCKED 列。
- **code-review 收斂為純呼叫方文件**：`opus-reviewer` 由「開工前載入 code-review」改為「派發 prompt 由呼叫方自模板展開、已內含完整規範，subagent 不載入」；通用模板新增追加 skills 條件區塊（`web-design-guidelines` 由 prompt 指示 subagent 載入）；`code-feat` Step 6 刪除內嵌 Reviewer prompt（第三份規範副本），改為 change 模式展開指示。每次 Reviewer 派發省下 subagent 整份 code-review（約 8.7k 字元）載入，review 規範三份副本收斂為一份，「受眾說明」段不再需要。

### Notes

- **減重判準（立為原則供日後複利）**：skill 條文只寫給執行期的 AI——判斷指引（「拿不準就保留」「判定保守」）留，規則的辯護詞與出處路標刪；抽象設計哲學不另立前言，精神體現在具體規則；規範副本要嘛是產物、要嘛不該存在（與 G13 同軸）。
- 減重不動任何 gate 順序、停損上限、STOP 條款與交付流程；除升級模式外執行契約不變。

## 0.10.0 — 2026-07-03

依 2026-07 設計審查逐項討論定案（25 條）分批實作。本版為審查落地版：文件層大掃除（drift 修正、權威宣告、措辭誠實化）、Tier 2 定位重寫與 spec-first 前移、Pipeline 行為修正（gate 序列化、typecheck、test-defect 仲裁、升級規則統一）、新能力（opus-reviewer plugin agent、retro 回饋迴路、description 生成腳本、路由案例集）。

### Fixed（Drift 逐條修，讓文件說實話——無行為改動）

- W6：`commands/feat.md` description 與 pipeline doc 流程總覽補上 0.9.0 漏同步的「∥操作流程驗證」；CHANGELOG 0.9.0 兩條 Changed 條目從 Removed 段移回 Changed 段。
- W16：`code-fix` 步驟重排——「報告結果」移到最後一步（原 Step 4 在註解整理與 Spec 檢查之前，與完成模板矛盾）。
- W17：Tier 3 分支命名統一為 `feat/<change-name>`（pipeline doc 兩處 `feature-<描述>` 改齊 skill 版）；流程總覽改為先 `/opsx:explore` 再建分支（與 Phase 1 詳細步驟一致）。
- W18：`code-feat` Step 6.5 觸發信號自己寫清楚，不再宣稱「沿用 Reviewer 偵測信號」（兩者條件本不相容）；明文**純樣式 changeset 不觸發操作流程驗證**——樣式驗不出流程斷裂，UI/UX 交 Reviewer 的 `web-design-guidelines`。
- W8：pipeline doc 載入表改與 `code-feat` 實際設計一致（操作流程驗證／註解整理由 orchestrator 載入 skill、展開模板注入，subagent 不自行載入）；`code-review` 各章節加受眾標頭（呼叫方 vs subagent），開頭補受眾說明。
- W20：pipeline doc 的 Spec 影響檢查移除前身專案殘留（`docs/plans/` 硬編碼、風力等級範例），泛化為「openspec/specs/ ＋ 專案 CLAUDE.md 定義的設計文件位置」；README Spec 同步段同步修正。
- C3：五處「繁體中文 UI 文字」硬編碼改為「CLAUDE.md 定義的 UI 語言慣例」（`code-review` 兩處、`code-feat` 兩處、pipeline doc 一處）——通用流程出貨於 kit、專案知識留 CLAUDE.md。
- W21：README 依賴表與驗證指令補漏 `vue-best-practices`；Tester 行補 `antfu`。
- W22：pipeline doc 修正 `/code:fix` command 路徑；`commands/fix.md` argument-hint 由 `[change-name]` 改 `[問題描述]`（code-fix 不吃 change name）；`marketplace.json` 的 `metadata.version` 由停滯的 0.4.0 對齊 plugin 版號。
- W13（措辭）：三處「誤刪功能型指令註解會在重跑測試時暴露」改為誠實版——「大多數誤刪會在此暴露；build-time pragma（`@__PURE__`、`webpackChunkName` 等）除外，測試驗不到，靠保護清單防守」（`code-comment` 兩處、pipeline doc 一處、`code-feat` Step 6.7 一處）。防線什麼等級就寫什麼等級。

### Changed（Tier 2 定位重寫＋spec-first 前移）

- **Tier 2（`code-fix`）定位確立**：「對話定案、乾淨執行、快速人工驗證」的執行品質層——品質高於主對話直改（fresh-context Coder 載守則＋Tester＋branch 隔離），重量低於 feat 驗證鏈（無 Reviewer、無操作流程驗證）。新增兩種進入場景：(i) 獨立小功能／改動；(ii) 進行中 change 的驗收修正（不讀 Tier 3 執行狀態，counter 與 model 棘輪歸零重起）。
- **路由判準改寫**（取代「2-5 檔、無需設計決策」）：決策已在對話收斂＋不需建立**新的** OpenSpec artifact → Tier 2；需要 spec 記錄（新增 API/元件、行為值得規格化）、決策分支多、需拆批 → Tier 3；單行/純樣式 → Tier 1。**檔案數降為輔助訊號**。明文化「微決策路徑」：1-2 題在對話收斂定案後即可派發（W10 結案）。
- **Spec 影響檢查前移（spec-first）**：`code-fix` 新增 Step 3「派發前 Spec 影響判斷」——場景 (i) 有影響先改 `openspec/specs/`、場景 (ii) 先回寫 change artifact，更新後的 spec 段落作為驗收依據注入 Coder prompt（Coder 拿權威版、Tester 稽核有 ground truth、仲裁錨更硬）；原 commit 前檢查降為 Step 7「輕量複核」（防實作範圍外溢）。三層 Tier 哲學統一：全部 spec 先行，差別只在儀式重量。
- 同步位置：`code-fix` SKILL（description、定位段、適用判斷、流程 Step 1-8、輸出模板、Guardrails）、pipeline doc（判斷標準表、流程總覽、Tier 2 專節、Spec 影響檢查段）、README（理念段、指令表、Spec 同步段）。

### Changed（Pipeline 行為修正——`code-feat` 大批次）

- **W1＋W9 Gate 序列化**：統一原則「靜態關卡（測試＋review）跟著每一次修復重新蓋章；動態關卡（操作流程驗證）永遠壓軸，驗的必是最終 code」。(1) 任何 gate FAIL 的修復完成後，修復 agent settle 前**自跑三件套（lint + typecheck + test）**——紅燈就地修不計 retry、就地修不掉回主對話記帳；全綠即 settle 不重派 Tester（修復後防的是機械回歸，Tester 的獨立價值在首輪設計測試）。(2) Reviewer 與操作流程驗證由平行改**序列**：Reviewer 迴路完全 settle 後才派發 verify-flow，其 PASS 不可能過期——「綠燈作廢」規則與 W9「同輪雙 FAIL 合併派發」條款因此都不需要存在。(3) verify-flow FAIL 的修復走完整靜態關卡（三件套 → Sonnet targeted re-check）後才 targeted re-run。Guardrails 平行派發補「檔案不相交」前提（通用防線）。取捨：快樂路徑 wall-clock 由 max 變相加——自主 pipeline 無人即時盯梭，wall-clock 是最便宜的貨幣，規則才是永久 drift 面。
- **W3 test-defect 仲裁通道＋Tester 重定義為獨立稽核者**：retry prompt 明文開申辯通道——Coder 判斷「測試與驗收依據不符」（不論測試作者）可回報 test-defect，**必須引用驗收依據原文**、引不出不受理；主對話改派 Tester 修測試（測試檔守護者一律是 Tester）。權力結構：Coder 有上訴權無裁判權，裁判是驗收依據原文（spec 說了算），終審是人。Tester 工作順序重排防錨定：①先讀 specs 獨立列應驗行為清單（**此階段禁看任何測試檔**）→②對照找缺口與錯斷言→③補寫/修正→④跑全套；Coder 明文允許順手寫自證測試（輸出列出供稽核）。
- **計數判準統一**：「品質失敗回到主對話、需派 agent 去修」＝計一圈；上訴輪同計。不計：ESLint/typecheck 自修、三件套就地修、BLOCKED、flaky 標註、targeted re-check/re-run。counter 語義＝「迴路為修品質問題轉了幾圈」，不做過錯歸屬。
- **G2 typecheck gate**：Coder 完成後與 lint 並列跑 typecheck（優先專案 `typecheck` script；Nuxt 用 `pnpm exec nuxi typecheck`，裸跑 vue-tsc 在未 prepare 的 Nuxt 專案會炸）；自修不計 retry（比照 ESLint 前例）；修復輪自跑組合為三件套。補上「兩處條文把型別委派給編譯器、但編譯器從未被執行」的空崗位；掛回合終點 gate（vue-tsc 有 OOM 前科不適合高頻 hook）。pipeline doc「指令執行慣例」擴為 lint / typecheck / test 共用並新增 typecheck 慣例段。
- **W19 升級規則統一＋W7 免重讀 escape hatch**：統一為「**同一迴路 counter ≥ 2 起，該迴路的修復派發升 Opus**」——Tier 2、Tier 3、測試迴路、Reviewer 迴路、驗證迴路一體適用；措辭**綁派發不綁角色**（上訴輪修復派發可能是 Tester）；棘輪不變。升 Opus 那輪**解除**「retry 免重讀 design/specs」限制（解禁非強制，範圍含 design.md 與 specs/）——判定需要深度推理的同時給足材料；前兩輪免重讀不變。`code-review` Grounding rules 補「spec alignment finding 必附被違反的 spec 段落原文（來源路徑＋段落內容），引不出原文的指控不成立」——orchestrator 全文轉遞後修復 agent 不必重讀 spec 檔，與 test-defect 引原文為同一 grounding 紀律、雙向對稱。
- **C5 派發中斷對帳＋C6 起跑髒檢查**：Coder/Tester 派發失敗或中斷 → `git status` 對照 tasks.md checkbox 對帳實際完成度後重派（磁碟優先）；Step 2 起跑加 advisory 髒檢查——`openspec/` 以外存在無關未 commit 修改時提醒不硬擋。
- 同步位置：`code-feat` SKILL（Model 表、Step 2/4/5/6.5、Retry 迴路全section、Guardrails）、`code-review` SKILL（Grounding rules）、pipeline doc（Phase 2 流程圖、Gate 排序原則、失敗處理策略、Model 升級條件、Coder/Tester/驗證 Agent 專節、指令執行慣例）、README（Agent 編排段）。

### Changed（散件收尾）

- **W5 composable 三層測試策略**：Tester 對 Nuxt composable 改為——①純邏輯抽獨立模組（既有規則不變）→ ②殘餘 runtime 依賴偵測 `@nuxt/test-utils` 已裝即直接測（`@vitest-environment nuxt` 只標需要重環境的檔；kit 永不主動安裝依賴）→ ③未裝才跳過＋輸出無法測試清單。**清單接上消費者**：Tier 3 在 verify-flow 觸發判斷加 OR 條件（清單非空且模組被頁面使用 → 純 composable 改動也強制觸發，受影響頁面注入 prompt targeted 驗證）；Tier 2 走報告行（見上方 W5）。封住「改 composable 可零 runtime 驗證走完全 pipeline」的空窗。
- **G7 中途規模矯正**：`code-guidelines` STOP 清單加第四款——「實際規模明顯超出派發宣告 → 回報，不硬做也不縮水交付」。Tier 判定在動手前、規模真相常在動手後揭曉；「要不要升 Tier 重走流程」是路由決策，歸 orchestrator／人。
- **G12 依賴 preflight**：四個 agent prompt（feat/fix 的 Coder 與 Tester）補「任一必載 skill 載入失敗（缺裝／改名）→ 停下回報，不在無慣例約束下繼續寫」（與 subagent 派發失敗紀律同構）；README 補相容性聲明（OpenSpec 目錄約定與 antfu/skills 命名為名字級依賴）。
- **W13（機械網）保護清單前後計數**：`code-comment` 整理前後對保護清單**逐 pattern** regex 計數並核對（不加總——總數不變可能互相掩護）；任一 pattern 變少即誤刪，補回才 settle。build-time pragma（測試驗不到）的機械防線；輸出「安全網」段新增計數行。
- **C4 debug 檔生命週期**：阻塞 debug 檔（含完整 diff）由專案根目錄改寫入 `.claude/debug/`（feat 與 fix），與 G10 截圖同家族，gitignore 一併蓋掉。

### Changed（Tier 2 品質補強——`code-fix` 批次）

- **W4 安全 review 聯動**：Tier 2 因安全敏感路徑（auth/payment/API key/session）升 Opus 時，聯動設 `{securityReview}=true`——Tester 通過後、註解整理之前，自動補派一次 **adversarial Opus review**（與 Tier 3 同款訊號同款待遇）。修補內部矛盾：同一訊號在 Tier 3 觸發 adversarial review、在 Tier 2 只升 model 就結束；安全殺傷力與改動行數無關，**分級管的是流程重量，不分掉安全底線**。FAIL 修復走完整靜態關卡（三件套 → targeted re-check）。
- **W5 Tier 2 報告行**：Tester「無法測試清單」非空且模組被頁面使用（grep 一條指令）→ 受影響頁面清單寫進完成報告新增的「人工確認提示」段。Tier 2 不派 verify-flow——洞的本質是人工確認時不知道爆炸半徑，給人 grep 清單即補上資訊差，要看多細由人決定（分級哲學）。
- **共通條文同步（與 Tier 3 對齊）**：Coder 完成後 lint + typecheck 自修；修復 Coder settle 前自跑三件套、全綠即 settle 不重派 Tester；計數判準統一（計一圈＝品質失敗回主對話派 agent 修；自修不計）；升級措辭統一（counter ≥ 2 起修復派發升 Opus，綁派發不綁角色；升 Opus 輪解除免重讀）；Tester prompt 注入 spec 驗收依據（spec-first 銜接）。
- 同步位置：`code-fix` SKILL（Model 策略、Step 4/5/5.5/6、Retry 迴路、輸出模板、Guardrails）、pipeline doc（Tier 2 專節）、`code-verify-flow`（與 Pipeline 的關係表 Tier 2 列）。

### Changed（操作流程驗證強化——`code-verify-flow` 批次）

- **W11 transient 重現確認**：判 FAIL 前**必須重現一次**——同一步驟再走一遍，錯誤再現才正式 FAIL 打回 Coder；重現不出 → 標記 **flaky**（不打回、不計 counter、不靜默判 PASS），寫進報告交人工驗收確認。重現是便宜的分類器：code 錯誤是確定性的、環境噪音是隨機的，一次重做即可分流且成本趨近零；與三態 verdict「環境噪音不污染 retry」哲學同構。輸出格式新增「flaky」段。
- **W12 dev server 身分**：輸出格式加一列「**實際驗證的 URL/port**」——純輸出、零行為規則，供人工對帳 dev server 身分。已知限制誠實記錄於決策：多 worktree 並行時仍有假綠燈風險，屆時再補條件規則。
- **G10 視覺佐證＋`.claude/debug/` 生命週期**：視覺型 FAIL（元件沒出現、跑錯區域、崩版）須附**截圖或幾何描述**（哪個元素、預期 vs 實際位置）；截圖存 `.claude/debug/`（不進版控）。生命週期兩層制：`code-feat` Step 7 報告後**主動刪**本次 change 的殘留檔＋Step 2 **lazy cleanup** 掃孤兒（對應 change 已不存在者刪，仍在者保留為接手線索）。
- 同步位置：`code-verify-flow` SKILL（判準精神、verdict 表、prompt 模板、輸出格式、與 Pipeline 的關係表）、`code-feat` SKILL（Step 2/6.5/7、Retry 迴路）、pipeline doc（驗證 Agent 專節、失敗處理策略）。

### Added

- **G5＋G8 `/code:retro` 回饋迴路（雙模式 skill ＋ 全域收件匣）**：新增 `code-retro` skill 與 `/code:retro` 指令。**記錄模式（預設，自動）**——`code-feat` Step 7 與 `code-fix` Step 8 完成報告尾端內建一行呼叫（SSOT：事件表與條目格式只活在 retro SKILL），對照列舉事件表記錄偏離快樂路徑的事件（gate FAIL 哪關第幾輪、counter 達 2/3、test-defect 仲裁、flaky、BLOCKED、G7 規模超標、驗收修正、pragma 攔截、安全 review、無法測試清單）＋快樂路徑統計行（調閾值的分母）；條目＝固定詞彙＋一行事實＋指路＋session 指針，**不寫解讀**；另設開放觀察欄收事件表外的異常（反覆出現→提案收進事件表，收集工具本身也被優化）。**歸檔模式（`--archive`，手動）**——讀收件匣→聚類找跨專案模式→需要時順 session 指針開採 transcripts（平行 subagent 分片）→附證據的 kit 優化提案→**徵求同意**→已消化條目移入 `runs-archive.jsonl`。檔案：`~/.claude/sdd-kit-feedback/runs.jsonl`（跨專案單一收件匣，自動 append 點只進不出）；>30 筆在完成報告提醒 `--archive`。定位翻轉：retro 受益對象是 **kit 不是專案**——教訓寫回 kit 的 prompt，**不寫專案 CLAUDE.md**（單專案受惠＋各專案規則各自演化是 drift 溫床）；源頭語義記錄召回率遠高於事後 transcripts 關鍵字開採。`scope_exceeded` 事件為 `docs/routing-cases.md` 新題候選（與 G9 接軌）。
- **A1 `opus-reviewer` plugin agent**（`plugins/code/agents/opus-reviewer.md`）：Reviewer 派發改走 plugin agent——frontmatter **鎖 `model: opus`**（「固定走 Opus」從派發參數的一句話變成機械保證）與**工具白名單**（Skill/Read/Grep/Glob/Bash，拿掉 Write/Edit——report-only 的工具層門檻；保留 Bash 供自跑 `git diff`，維持「只傳變更名稱、agent 自讀」的 context 經濟。誠實標註：提高失誤門檻，非 sandbox 保證）。agent 本體薄殼，仍載入 `code-review` 為規範單一來源（不破壞 SSOT）；**報告第一行自報實際 model**（零成本 runtime 降級偵測）。`code-review`／`code-feat` Step 6／`code-fix` Step 5.5 的派發參數統一改為 `subagent_type: opus-reviewer`；targeted re-check 維持 general-purpose + sonnet 不變。
- G9 路由回歸案例集 `docs/routing-cases.md`：15 句 canonical 需求 → 預期 Tier 對照表（照第 21 條新判準寫，含邊界案例：對話定案小功能→Tier 2、驗收修正→Tier 2 場景 ii、小型新 API→Tier 3 陷阱題、決策未收斂→不派發）。kit repo 維護工具，不進 plugin 出貨、不被 runtime 載入——是改 description 措辭時的校準考卷，逐句對答案全對才放行，錯誤死在 kit repo。與 retro 迴路接軌：G7 規模超標實例為新題候選。`code-feat` description 同步對齊新判準（檔案數降為輔助訊號、補「行為值得規格化／需拆批」、指路改「決策已在對話收斂的小改動改用 code-fix」），command 副本經腳本重新生成；新 description 首考 15/15。
- G13 防 drift 生成腳本 `scripts/sync-descriptions.mjs`：command frontmatter 的 description 改由腳本**從對應 skill 的 description 生成**，不再手寫——副本從「人寫的手抄本」變成「建置產物」，重跑即同步；附 `--check` 模式（發版前機械檢查，待同步差異或版號不一致即 exit 1）。版號一致性（plugin.json ＝ marketplace plugins[].version ＝ metadata.version）用比對不用生成——多處同值沒有主體可抄。判準一句話：**腳本能從主體算出副本 → 生成；敘事改寫 → G14 權威宣告；多處同值 → 比對**。立原則供日後複利：副本要嘛是產物、要嘛不該存在。首跑重新生成 4 個 command description（comment/fix/review/verify-flow——其中 fix 為第 21 條新判準版，review/comment/verify-flow 統一為 skill 版原文）。
- G14 權威宣告：pipeline doc 開頭與 README 明文文件權威層級——**SKILL.md（執行契約權威）＞ pipeline doc（方法論）＞ README（摘要）**，說法衝突以 SKILL.md 為準並視為文件 bug。宣告不防 drift 發生，但把傷害從「各信一邊」降為「都知道以誰為準」。

### Notes

- **明文不做（審查定案的擱置區，理由見決策記錄）**：A2 pipeline 狀態檔（簡單場景對話記帳即可、災難恢復由磁碟優先架構承擔；極簡設計保留供日後重評）、A3 spec-code 同 commit hook（commit 刻意留在 kit 流程外）、C2' 回歸測試紅燈驗證（git stash 操作風險；若日後撿回走 TDD 排序）、W14 決策清單落盤（compaction 實務少發生、可用 --resume 自救）、G6 sync-map（對照表本身是會腐化的副本）、G11 spec 庫寫入序列化條文（單線開發現行設計正確；多 worktree 並行不在作者實務中）。
- 「Code 和 Spec 同一個 commit」不變量不動；三層 Tier 統一為「全部 spec 先行，差別只在儀式重量」。
- 新指令（`/code:retro`）與新 agent（`opus-reviewer`）需重載 plugin（重新 install 或重啟 Claude Code）才會生效。

## 0.9.0 — 2026-07-02

新增 `code-verify-flow` skill 與 `/code:verify-flow` 指令：在 Phase 2 尾端補上「操作流程驗證」閘門，作為 Phase 3 人工驗收的前置過濾器。過去自動化只有 vitest（驗零件邏輯，mock、靜態），驗不到「零件組起來真接上跑會不會斷」；這類低級問題（流程走不通、報錯、明顯崩版）一路留到人工驗收才被發現。本 skill 透過 claude-in-chrome 在真瀏覽器實際點擊走完 spec 設計的流程，擋掉這層，讓開發者專注在 AI 碰不了的判斷題（美感、資料合理性、體驗）。刻意採「北極星 + 邊界」而非機械檢查表——職責邊界訂死、方法與灰色地帶判斷留給模型，並設計為不綁專案可攜。

### Added

- 新增 `plugins/code/skills/code-verify-flow/SKILL.md`：可攜、不綁專案的操作流程驗證 skill。職責邊界為硬護欄（只驗 spec 明文寫的：流程走得完、無 console error/未預期 4xx-5xx/卡死、spec 點名元件的存在/可見/可互動、spec 明文位置的粗粒度判定；絕不碰美感/間距/差幾 px/資料合理性）；判準精神而非死步驟，方法自選；console warning 分級（error/exception/5xx→FAIL，warning→回報不 block）；verdict PASS/FAIL/BLOCKED，且 BLOCKED 須指明子原因。「spec」抽象為「驗收依據」，無正式 spec 時 fallback 到 task/PR 描述。
- `code-verify-flow` 的環境韌性：開工 preflight 確認 claude-in-chrome 就緒，未就緒 → BLOCKED（子原因：工具未就緒）**優雅退化為跳過本關、退回純人工驗收**（非 FAIL、非靜默放行）；登入牆分三路處理（優先已驗證入口 / 登入是被測流程才用測試帳密 / 過不去判 BLOCKED），含安全硬規則（絕不自創帳密、不用開發者本人帳號、帳密不寫進報告）與反 rabbit-hole（同道牆 2-3 次即停、不觸發 dialog、不解 CAPTCHA）。
- 新增 `plugins/code/commands/verify-flow.md`：`/code:verify-flow` 指令入口。

### Changed

- `code-feat`（Tier 3 orchestrator）：新增 Step 6.5「操作流程驗證」（與 Reviewer 同層 gate，可平行、都綠才進註解整理），原註解整理順延為 Step 6.7；front matter、Skills/Model 表、Retry 迴路（新增「操作流程驗證 FAIL → Coder 修復」小迴路與計數）、輸出格式、Guardrails 均納入。觸發條件為改動觸及 UI/流程。
- `code-fix`（Tier 2 orchestrator）：**維持不變**，刻意不納入操作流程驗證——Tier 2 輕量（連 Reviewer 都省），流程驗證比 Reviewer 更重，小改動人工瞄一眼即可；需要時獨立跑 `/code:verify-flow` 或升 Tier 3。
- `ai-development-pipeline.md`：Phase 2 Agent Pipeline 圖改為 Reviewer ∥ 操作流程驗證同層 gate（可平行、都綠才進註解整理）；新增「操作流程驗證 Agent」專節；失敗處理策略、Model 分層表、Agent Knowledge Skills 載入表、工具依賴表、Tier 3 流程總覽、Skill 架構分類表均納入；Phase 3 補述「前置過濾器」定位。
- README：指令表新增 `/code:verify-flow` 列、Agent 編排段新增「操作流程驗證」項、`/code:feat` 流程圖納入。
- `plugin.json`、`marketplace.json` 的 plugin 版號升至 0.9.0，description 補上 `code-verify-flow`。

### Removed

- `ai-development-pipeline.md`：移除「實驗記錄」段（實驗 1/2/3，2026-02～03 的早期驗證紀錄）——內容已久遠、發現事項均已落地進流程，留著意義不大。Orchestrator「現狀」附註中對「兩次實驗」的懸空引用一併改為「已實測可行」。

### Notes

- 定位為**前置過濾器不取代人工驗收**：擋低級的「流程走不通」，縮小人工驗收範圍，不接手 AI 碰不了的判斷題。
- 觸發條件為改動觸及 user-facing 流程/畫面（如 `.vue` template）；純後端/composable、Tier 1 微調跳過。
- 排序理由：與 Reviewer 同屬「會打回 Coder 的 gate」故同層；註解整理只動註解不動邏輯、必排所有 gate 之後跑一次，且不會弄壞走得通的流程，故驗證永不因註解整理重跑。
- 呼應「自主優先」：灰色地帶（驗收依據含糊、算不算壞模稜兩可）描述現象、標待人確認，不擅自放行也不擅自 block。
- 新指令需重載 plugin（重新 install 或重啟 Claude Code）才會生效。

## 0.8.0 — 2026-06-23

新增 `code-decisions` skill 與 `/code:decisions` 指令：在 `opsx:explore` 與 `opsx:propose` 之間補上「動手前決策收斂」閘門。explore 是發散探索、容易聊到「感覺完整」就進 propose，未定的小細節（邊界、空狀態、錯誤情境、需求衝突）便被包裝成看似完整的 spec，最後在 Coder／Reviewer／retry 階段才爆出來。本 skill 沿決策樹只挑「Coder 動手時必須有答案、但目前未定」的分支逐一收斂，把 `code-guidelines` 的「預防比 retry 便宜」思路延伸到設計端。

### Added

- 新增 `plugins/code/skills/code-decisions/SKILL.md`：判準驅動（決策樹 + 「多種合理實作 × 目前無明確答案」雙條件），清單僅作非窮舉引子避免侷限 AI；借 grilling 機制（一次只問一題、附建議答案、能查 codebase 就不問人、處理分支依賴），找不到未定分支即如實回報「無未定決策」不硬湊問題。職責單一：只收斂決策，不產 spec、不寫 code。
- 新增 `plugins/code/commands/decisions.md`：`/code:decisions` 指令入口，frontmatter description 與 skill 對齊。

### Changed

- `ai-development-pipeline.md`：工具依賴表、Tier 3 流程總覽、Phase 1 流程圖與詳細步驟（新增「3. Decisions」、Propose 順延為第 4 步）、Skill 架構分類表均納入 `code-decisions`。
- README：指令表新增 `/code:decisions` 列、最小範例插入該步驟、理念段補述其為「預防思路延伸到設計端」。
- `plugin.json`、`marketplace.json` 的 plugin 版號升至 0.8.0，description 補上 `code-decisions`。

### Notes

- 判斷軸為「未定決策分支多寡」而非前端／後端：完整新功能、全新 UI 流程設計適用；既有功能調整、需求已明確、純樣式微調可跳過。
- 定位為**可選**步驟，置於 explore 之後、propose 之前；不動既有 pipeline 行為（派發、retry、model 升級、Spec 同步規則皆不變）。
- 新指令需重載 plugin（重新 install 或重啟 Claude Code）才會生效。

## 0.7.1 — 2026-06-23

強化 `code-feat`、`code-fix` 的 skill description，讓「該用哪一個」的路由判斷隨 plugin 出貨、裝好即可靠運作，不依賴專案 CLAUDE.md 額外設定。Claude Code 安裝 plugin 後會自動以 skill 的 `name + description` 判斷適用情境——原描述只標 Tier 等級，缺鑑別條件與互相指路，AI 需靠語意猜測；本次補上判準，讓自動建議不靠運氣。

### Changed

- `code-feat` description 補上鑑別條件（5+ 檔或跨模組、需設計決策、新增 API/元件）、前提（需已有 OpenSpec change：`openspec/changes/<name>/` 含 `tasks.md`）與指路（小改動改用 `code-fix`）。
- `code-fix` description 補上鑑別條件（2-5 檔、無需設計決策、不新增 API/元件）與指路（需完整設計流程改用 `code-feat`；單行/純樣式微調直接在對話改）。
- `commands/feat.md`、`commands/fix.md` 的 frontmatter description 同步更新，與對應 skill 保持一致。

### Notes

- 此為路由可靠度的改善，不動 pipeline 行為（派發、retry、model 升級規則皆不變）。
- 專案特定慣例（UI 語言、設計系統、CSS 變數）仍由 runtime 從專案 CLAUDE.md 讀取——通用流程出貨於 kit、專案知識留在 CLAUDE.md 為刻意的分層。

## 0.7.0 — 2026-06-16

新增 `code-guidelines` 行為守則 skill，由 Coder 在動手前載入，針對 LLM 寫 code 的通病（亂假設、過度設計、亂改不該動的地方），從生成端先自我約束。原本這些性質只由 Reviewer 在事後攔截（過度抽象、只改必要），現在從生成端先自我約束——預防比 retry 便宜（少一輪 Opus review + 重跑測試）。skill 分類從「知識型 / 流程型」擴為加上「行為型」第三類。

### Added

- 新增 `plugins/code/skills/code-guidelines/SKILL.md`：定義 Coder 的四條行為守則——①自主判斷邊界（spec 沒寫死的技術細節自己決定、把假設寫進輸出摘要，只有觸及功能方向／缺人類資訊／不可逆操作才 STOP）、②最小可行實作、③外科手術式改動、④目標導向交付。

### Changed

- `code-feat`、`code-fix` 的 Coder 必載 skills 加入 `code-guidelines`（置於知識型 skill 之前，先讀再動手）；Step 4 / Step 2 的 Coder prompt 載入行同步更新，並在 Guardrails 補「含 retry 派發一律先載入行為守則」。
- `ai-development-pipeline.md`：Coder skill 載入表、Coder Agent 段同步加入 `code-guidelines`；「知識型 vs 流程型分離」段擴為「知識型 vs 流程型 vs 行為型」三類，並說明 `code-guidelines`（生成端自律）與 `code-review`（審查端把關）為同源配對。
- README 說明段與 Agent 編排段補述行為守則層；`plugin.json`、`marketplace.json` description 加註 `code-guidelines`。

### Notes

- 行為守則僅由 Coder 載入（唯一的 code 生成者）。Reviewer 已在審查端檢查同一組性質、Tester／註解整理各有專屬守則，故不重複載入以避免冗餘。
- 第①條「自主判斷邊界」刻意偏向讓 AI 自主完成：技術細節自己拍板、把假設寫進摘要而非停下問人，僅在功能方向／缺人類資訊／不可逆操作時才中斷。

## 0.6.0 — 2026-06-12

解除對 Spectra 的工具耦合，改為由 OpenSpec 變更 artifact 驅動。原本 skill 會直接呼叫 `spectra` CLI 並提示 `spectra:*` 指令，導致必須額外安裝 Spectra；實際上 pipeline 依賴的只是 `openspec/` 目錄與 artifact 格式（Spectra 底層就是 OpenSpec）。本次把前端工具綁定拿掉，讓 plugin 更單純、少裝一層。

### Changed

- `code-feat` Step 1/2 改為工具無關：不再執行 `spectra list --json` / `spectra status --json`，改為讀取 `openspec/changes/` 目錄與確認 `tasks.md` 存在；下一步提示由 `/spectra:verify`、`/spectra:archive` 改為 `/opsx:verify` → `/opsx:sync` → `/opsx:archive`。
- `code-fix`、`code-review` 的描述性 `Spectra artifacts` 字眼一律改為中性的「變更 artifact」或「OpenSpec 變更 artifact」。
- `ai-development-pipeline.md` 工具依賴表、Phase 1/4 流程、Skill 架構表改以 OpenSpec 指令（explore、propose、apply、verify、sync、archive）描述；Phase 4 因 OpenSpec 的 sync 與 archive 為獨立步驟，補回 `/opsx:sync`。
- README 前置依賴表 `Spectra CLI（必裝）` 改為 `OpenSpec（建議）`，最小範例與交付步驟改用 `/opsx:*` 指令。
- `plugin.json`、`marketplace.json` 的 description 從「with Spectra integration」改為「driven by OpenSpec change artifacts」。

### Removed

- 刪除文件中 OpenSpec 無對應的 Spectra 專屬步驟：Phase 1.5（analyze / clarify）與「跨階段 Spectra Skills」（debug / tdd），以及 `ingest` 提示。

### Notes

- 「工具無關」僅限 OpenSpec 相容的前端工具（OpenSpec CLI、Spectra、手刻）；skill 仍依賴 OpenSpec 的目錄與檔名約定（`openspec/changes/<name>/` + `proposal.md` / `design.md` / `tasks.md` / `specs/`），故 spec-kit 等不同 artifact 契約的工具無法直接相容。
- 「實驗記錄」與既有版本的 changelog 屬歷史敘述，保留當時的 `spectra` 用詞不動。

## 0.5.2 — 2026-06-08

`code-comment` 冗餘判準強化：把核心判準的評估視角明確定為「功能完成後、不知道開發過程的讀者」，並讓「冗餘」涵蓋語意複述而非僅字面直譯——解決「作用已由語意化 class／handler 名稱表達、卻仍寫一條標籤式註解」這類抓不掉的狀況。以強化單一大原則達成，不新增 case 規則。

### Changed

- `code-comment` 核心判準開頭改以「完成後讀者」視角評估：凡讀 code 本身（含語意化命名、結構，必要時對照鄰近檔案如 CSS／型別）即可在合理成本內看懂者皆為冗餘；唯跨越開發期仍成立的「為什麼」保留。判準從「寫的當下有沒有價值」改為「留在成品裡對未來讀者有沒有增益」；安全閥維持「拿不準就保留並列入保留決策覆核」。
- `冗餘複述` bad pattern 特徵從「字面直譯」放寬為「複述已由命名／結構表達的作用」，涵蓋語意複述（如 `// 品牌大圖覆蓋層` 對 class `logo-page-overlay`），未新增表格列。
- README 指令表與 Agent 編排段同步描述新判準。

## 0.5.1 — 2026-06-08

lint / test 指令一致化：把 `code-feat`、`code-fix` 既有的 Coder / Tester 指令從硬寫 `npx` 改為偵測專案 package manager 與 scripts，與 `code-comment` 收尾步驟的做法統一。

### Changed

- `code-feat`、`code-fix` 的 Coder prompt 不再寫死 `npx eslint --fix`，Tester prompt 不再寫死 `npx vitest run`；改為「優先專案 script（如 `pnpm lint --fix`、`pnpm test`）→ 無對應 script 才 fallback 到 `pnpm exec` → 避免裸 `npx`」。
- `ai-development-pipeline.md` 的「ESLint 三層防線」新增「指令執行慣例（lint / test 共用）」小節作為單一規範來源；Coder Agent 職責、Pipeline 圖、註解整理段同步改為「專案 lint script」。
- README Agent 編排段的註解整理安全網描述同步。
- 概念性提及 ESLint（git hook、CI、三層防線命名）維持不變——antfu 技術棧的 linter 本來就是 ESLint，本次只統一「怎麼呼叫」。

## 0.5.0 — 2026-06-08

新增 `code-comment` 註解整理 skill，並掛進 Tier 2 / Tier 3 Pipeline 的開發收尾。解決 AI 開發過程中不斷疊加註解、把思考流程寫進註解、註解過時沒跟上 code 的問題——收尾時以 fresh-eyes subagent 清除壞註解，只留說明「為什麼」與功能型指令的有效註解。

### Added

- 新增 `code-comment` skill（`plugins/code/skills/code-comment/SKILL.md`）與 `/code:comment` command。透過 Task tool 派發 **Sonnet 整理 Agent subagent**，與主對話隔離取得 fresh-eyes 視角（避免「剛寫完註解的人最難判斷哪些是廢話」的自評盲點）。
- 整理判準（single source of truth）：清除過時/矛盾、疊加殘留、思考流程口吻、冗餘複述、註解掉的死碼、空泛 TODO；保留解釋「為什麼」、JSDoc/docstring、複雜演算法說明、授權標頭、具體 TODO/FIXME。原則「刪除是危險方向，拿不準就保留」；修正過時註解時明令「不可改寫成只複述 code 的 what-comment」。
- 功能型指令註解保護清單涵蓋 linter/格式器（`eslint-disable`、`prettier-ignore`、`biome-ignore`、`stylelint-disable`）、TypeScript（`@ts-expect-error`/`@ts-ignore`/`@ts-nocheck`）、測試/coverage（`@vitest-environment`、`istanbul ignore`、`c8 ignore`）、bundler/編譯 pragma（`@__PURE__`、`@jsx`/`@jsxImportSource`、`@vite-ignore`、`webpackChunkName`、`@preserve`/`@license`）、框架（`v-html` 安全註記）——這些被誤刪一般測試不一定抓得到。
- 與 `code-review`（report-only + STOP）不同，整理 Agent 依守則**直接套用 Edit** 並自跑 lint --fix；orchestrator 在整理後**重跑測試**作為安全網（誤刪功能型指令註解會在此暴露）。安全網指令依專案 package manager / scripts 偵測（優先 `pnpm lint` / `pnpm test`），不寫死 `npx`。
- 掃描範圍分級：獨立模式預設只清 diff 改動區及其鄰近註解（避免誤傷他人 ownership 的舊碼），`--whole-file` 才放寬；Pipeline 模式因檔案是該 pipeline 自己寫的，允許整個 changed file。

### Changed

- `code-feat`（Tier 3）新增 Step 6.5「註解整理」：Reviewer PASS 後派發 Sonnet 整理 Agent，retry 全部 settle 後一次清最終狀態。Model 策略表、Phase 2 完成輸出、Guardrails 同步更新。
- `code-fix`（Tier 2）新增 Step 4.5「註解整理」：Coder/Tester settle 後、Spec 影響檢查前執行。Model 策略表、完成輸出、Guardrails 同步更新。
- `ai-development-pipeline.md` 新增「註解整理 Agent」章節，更新 Phase 2 Pipeline 圖、Model 分層策略表、Agent Knowledge Skills 載入表、Tier 2/3 流程圖。
- README 指令表與 Agent 編排段補上 `/code:comment`。

## 0.4.0 — 2026-05-18

Coder agent 改為條件式 model 選擇：預設維持 sonnet 以節省額度，僅在先驗上需要深度推理或 retry 卡關時升 opus。Pipeline 的 Tester + Opus Reviewer + retry 結構已能接住 sonnet 第一版的表層瑕疵，故不全面切換。

### Changed

- `code-feat` 新增 Step 3「Coder Model 升級判定」：架構變更 / 大型重構、安全敏感路徑、設計決策密集任一成立時 `{coderModel}` 升 opus，否則維持 sonnet。Step 4 派發改用 `{coderModel}` 變數。
- `code-feat` Retry 迴路：Reviewer counter ≥ 2 時，除既有的強制 adversarial 外，`{coderModel}` 一併強制升 opus 且不再降回。
- `code-fix` Coder 改為 sonnet（預設）/ opus：因 Tier 2 依定義無設計決策，僅保留「安全敏感路徑」首次升級條件，加上「Coder ↔ Tester retry 第 2 輪起升 opus」的動態升級。

## 0.3.0 — 2026-05-13

Replaced the Codex-backed Reviewer with an Opus subagent dispatched via the Task tool. Removes the external `openai-codex` plugin dependency and the associated companion-runtime plumbing while preserving the "independent reviewer" guarantee (now via Sonnet → Opus tier jump + subagent context isolation, instead of cross-vendor model).

### Changed (Breaking)

- Reviewer now runs as an Opus subagent dispatched via the Task tool. Independence is preserved through a Sonnet → Opus tier jump plus subagent context isolation rather than a cross-vendor model.
- `code-feat` Step 6 collapses the previous 6a (Codex code quality) + 6b (Sonnet spec alignment + integration) split into a single Opus subagent that covers code quality, security, project conventions, spec alignment, and final output formatting in one pass.
- `code-review` `--change` mode's `grounding_rules` and `structured_output_contract` (previously embedded in the Codex `task` prompt) are absorbed into a unified Reviewer Subagent prompt template, shared across all scopes.
- `code-review` `--staged` mode no longer needs the manual fallback path that existed because Codex `review` did not support staged scope — all modes now go through the same subagent dispatch.
- Adversarial review is no longer a separate Codex `adversarial-review` subcommand; it is an `adversarial=true` flag on the same prompt template that switches on a red-team analysis section. Trigger conditions (security-sensitive paths, 2nd retry still failing, explicit user request, auto-escalation inside `code-feat`) are unchanged.
- WARNING re-check continues to run as a Sonnet subagent against `code-review`'s targeted-check mode (unchanged behavior).

### Removed

- `openai-codex` plugin dependency. README's prerequisite table no longer lists it.
- `codex-companion.mjs` path discovery (`~/.claude/plugins/cache/openai-codex/codex/*/scripts/`), `CODEX_COMPANION` env-var override, `--wait` background-job fallback (output-file polling + `status --json`), and the guidance against `result <jobId>` — all obsolete now that dispatch goes through the Task tool.
- Loading of `codex:codex-result-handling` and `codex:gpt-5-4-prompting` skills from the `code-review` flow.

### Migration

No state migration required. If `code@openai-codex` was installed solely to support `claude-sdd-kit`, it can be removed.

## 0.2.0 — 2026-05-04

Initial post-launch maintenance: fix command registration, align Coder skill rules between Tier 2 and Tier 3, and resync version metadata so `/plugin update` could pick up changes.

### Fixed

- Command files (`/code:feat`, `/code:fix`, `/code:review`) used non-standard frontmatter fields (`name`, `category`, `tags`) that Claude Code refused to register. Replaced with the standard `description` + `argument-hint` schema, and added `$ARGUMENTS` so commands forward arguments to their underlying skills.
- `marketplace.json` and `plugin.json` versions were out of sync, blocking `/plugin update` from detecting the new release. Both manifests now share the same version string.

### Changed

- Coder skill rules are now identical between `/code:feat` (Tier 3) and `/code:fix` (Tier 2): `vue-best-practices` moved from optional to required in `code-fix`, so cross-file fixes don't drift in style from feature work. Tier differences are now expressed in flow (Spectra integration, Reviewer) rather than in style strictness.
- `pnpm` / `turborepo` skill triggering now uses objective signals (`package.json`'s `packageManager` field, `pnpm-lock.yaml`, `turbo.json`) instead of subjective task-content heuristics.
- `web-design-guidelines` skill triggering narrowed to `.vue` `<template>` / `<style>` blocks or pure stylesheet files (`.css` / `.scss` / `.sass` / `.less`); pure `<script>` changes no longer trigger UI/a11y review skill loading.

## 0.1.0 — 2026-04-29

Initial release. Migrated from `ai-oil-pollution-analysis` project-level setup to a standalone Claude Code plugin marketplace.

### Added

- `code` plugin containing three skills:
  - `code-feat` (Tier 3 SDD pipeline)
  - `code-fix` (Tier 2 lightweight pipeline)
  - `code-review` (standalone Codex-backed review)
- Slash commands `/code:feat`, `/code:fix`, `/code:review` (trampolines into the corresponding skills).
- `docs/ai-development-pipeline.md` — full methodology documentation.

### Changed (vs. the original project-level skills)

- Codex integration no longer relies on `${CLAUDE_PLUGIN_ROOT}` (which would resolve to this plugin's root, not openai-codex's). Both `code-feat` and `code-review` now auto-discover `codex-companion.mjs` under `~/.claude/plugins/cache/openai-codex/codex/*/scripts/`, overridable via `CODEX_COMPANION`.
- Removed hardcoded openai-codex path/version from `code-review` Step 3.
- Generalized project-specific review checks: removed `.glass-card`, `14px / 24px+` examples; replaced with "follow project design system conventions" and "rules defined in project CLAUDE.md".
- `code-fix` Spec impact check now references only `openspec/specs/` and "design-document locations defined in project CLAUDE.md", removing the project-specific `docs/plans/` paths.
