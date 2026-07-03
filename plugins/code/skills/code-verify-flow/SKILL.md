---
name: code-verify-flow
description: Use when you need to confirm a spec-designed user flow actually runs end-to-end in a real browser — drives real clicks to check the flow completes without errors/interruptions, verifies spec-stated elements exist and sit where the spec says; does NOT judge aesthetics, spacing, or data correctness (those stay with the human)
---

一個**可攜、不綁專案**的「操作流程驗證」skill。它在真實瀏覽器裡把 spec 設計的使用者流程實際走一遍（真的點擊、真的填表、真的跳頁），確認**流程串得起來、不報錯、不中斷**，而不是驗「畫面對不對、好不好看」。透過 Task tool 派發 fresh-context subagent 執行，取得與寫 code 的 context 隔離的獨立視角——避免「自己寫的畫面自己驗」的自評盲點。

**定位（跟 vitest 分工）**：

| | 驗什麼 | 環境 |
|--|-------|------|
| 單元/元件測試（vitest 等） | 每個零件的**邏輯對不對**——函式行為、edge case、回歸 | 靜態、mock、快 |
| **本 skill** | 零件**組起來會不會動**——真 dev server + 真點擊 + 真資料流下，spec 設計的流程走不走得通 | 真瀏覽器、真整合 |

兩者互補不重疊：mock 出來的測試天生驗不到「真的把它接起來跑會不會斷」，這正是本 skill 補的那一層。

**核心哲學：給北極星 + 邊界，不給檢查表。** 本 skill 刻意**不**把每一步寫死成機械流程。它定義「職責邊界」（什麼該驗、什麼不該碰）與「判準精神」，把「怎麼走、怎麼確認、灰色地帶怎麼拿捏」留給模型發揮。過度規範會綁死模型判斷，也讓 skill 難以搬到形態不同的專案。

---

## 職責邊界（這是硬護欄，不能鬆——它正是「不變成雜訊來源」的保證）

### 只做這些

- **走 spec 設計的流程**：依驗收依據描述的路徑，實際操作到終點，回報途中有沒有撞牆
- **只驗 spec 明文寫出的東西**：流程步驟、spec 點名的關鍵元件、spec 明文規定的位置
- **回報，不當裁判**：把觀察到的事實（走到哪斷了、哪個元件沒出現、console 噴什麼）如實回報

### 絕不碰這些（← 交給開發者的判斷題）

- **美感 / 視覺細修**：間距勻不勻、對齊、差幾 px、配色、視覺平衡
- **資料合理性**：數字合不合理、內容對不對（它看得到「有沒有顯示資料」，看不出「這個值在業務上合不合理」）
- **spec 沒寫的任何東西**：spec 沒規定的地方保持沉默，不自己加戲、不自己想像「應該長怎樣」

**一句話界線**：驗 spec 明文寫的一切；spec 沒寫的視覺與資料判斷，一律留給人。

---

## 判準精神（是精神不是清單——用你的判斷套用）

驗證分兩層。以下描述「大致要看什麼」，**具體怎麼確認由你挑順手的方法**（瞄截圖、讀 DOM、看元素相對關係、跑一段 script 都行）。

### 流程層——走得完、不報錯、不中斷

大致對應這些「明顯撞牆」的信號，命中才算 FAIL：

- 流程**走不到終點**（按鈕點了沒反應、跳頁卡住、下一步元素永遠不出現）
- **卡死 / 白畫面 / 無限 loading**
- console **`error`** 或未捕捉的 exception
- **未預期的 network 4xx / 5xx**（該成功的請求失敗了）

**FAIL 前的重現確認（必做）**：命中失敗信號後，先把**同一步驟再走一遍**——錯誤再次出現才正式判 FAIL 打回 Coder；重現不出 → 標記 **flaky**：不判 FAIL、也**不靜默當 PASS**，寫進報告交人工驗收確認。理由：code 造成的錯誤是確定性的（重做穩定再現），環境噪音是隨機的（HMR 抖動、冷啟動、偶發 timeout）——一次重做即可分流，且只是同一瀏覽器 session 多走一遍，成本趨近零。真正的間歇性 bug（race condition 類）可能兩次都不現身，所以不判 PASS 而是誠實標註交人——agent 只自動化「確定的」，「不確定的」留給人。

### 元件層——只驗 spec 點名的關鍵元件

驗哪些元件，由**驗收依據點名的**決定（例如 scenario 寫「點擊拍照按鈕」→ 就驗「拍照按鈕」），**不要自由發揮去掃畫面上每個元素**（範圍無界會發散）。對這些被點名的元件，看：

- **存在**：真的渲染進 DOM 了
- **可見**：有尺寸、非隱藏、在 viewport 內、沒被其他東西蓋住
- **可互動**：點得到（該點的東西真的 hit-testable）
- **spec 明文的位置**：spec 有寫位置才驗，且**只驗粗粒度**——落在對的區域（右上/置底/固定於頂…）或相對關係對（A 在 B 上方、X 在 Y 右側）。**明顯跑錯地方才 FAIL**（spec 說右上角卻跑到左下角、或版面崩掉擠成一團）；「在右上角只是差 15px 沒對齊」→ **不是你的事，放行**。

> **粒度線（很重要，鬆了就掉回 flaky 地獄）**：
> - ✅ 你答得了：在不在對的**區域** / 相對關係對不對 / 有沒有明顯崩版
> - ❌ 你不碰：差幾 px、對不對齊網格、間距勻不勻、視覺平不平衡

### console warning 的處理——抓得到，但分級

真瀏覽器會噴出 mock 環境浮不出來的 runtime warning（如 hydration mismatch、unhandled rejection），這是額外紅利。但**抓得到 ≠ 該 FAIL**：

| console 訊號 | 處理 |
|-------------|------|
| `error` / 未捕捉 exception / network 5xx | **失敗信號 → FAIL** |
| `warning` | **回報但不 block**——寫進輸出提醒開發者，不擋流程 |

「這個 warning 該不該理」由你判斷：**跟本次變更/流程相關的**值得標記提醒，框架/第三方環境噪音（deprecation、favicon 404、source-map…）略過。不寫死白名單——這正是留給你發揮的地方。

---

## 灰色地帶怎麼辦（呼應自主優先：能自主就自主，拿不準就 surface 而非硬判）

- 驗收依據**寫得含糊**、或「這算不算真的壞掉」在模稜兩可地帶 → **描述你看到的現象、標為待人確認**，既不擅自放行、也不擅自 block
- **分不清是功能壞了還是環境/資料問題**（dev server 沒起乾淨、seed data 不對、頁面根本連不上）→ 判為 `BLOCKED`，交人處理，**不要**把它算成「功能 FAIL」去打回 Coder（環境的脆弱不該污染 retry）

---

## 執行

### 輸入

呼叫方（Pipeline 或人）提供：

1. **App 進入點**：正在跑的 app URL（dev server 位址），或啟動方式。**功能在登入牆後面時，優先提供「已驗證的入口」**——dev 已登入 session / seeded cookie / 測試帳號自動登入 / dev 環境的 auth bypass——讓驗證直接從 app 內部開始（用 UI 真的打帳密每次跑都脆弱，能免則免）
2. **驗收依據**：要走的流程從哪來——依專案手上有什麼，優先序：
   - 正式 spec / scenario（如 OpenSpec `specs/`、Gherkin、驗收條件文件）
   - 沒有正式 spec 時 → fallback 到 task 描述 / PR 描述 / 需求敘述
3.（可選）**要特別確認的關鍵元件 / 位置**：呼叫方已知的重點，沒給就由 subagent 從驗收依據自行推出
4.（可選）**測試帳密**：只有「登入本身就是 spec 要驗的流程」時才需要，由呼叫方提供**測試環境帳號**。缺這個又遇到登入牆 → 判 BLOCKED（見下方）

> **可攜性**：本 skill 不假設任何特定框架、spec 格式或 package manager。「驗收依據」是抽象概念——有什麼用什麼。

### 派發 subagent

用 Task tool 派發 fresh-context subagent（預設 `subagent_type: general-purpose` + `model: sonnet`；走瀏覽器流程屬操作性工作，Sonnet 足夠，且與主對話隔離取得獨立視角）。prompt 用下方模板展開。

Subagent 需要 **claude-in-chrome 瀏覽器工具**（`tabs_context_mcp` / `navigate` / `computer` / `read_page` / `read_console_messages` / `read_network_requests` 等）。若這些工具是 deferred，subagent 須先用一次 ToolSearch 批次載入再操作。

**派發失敗或 app 起不來**：記錄狀況、判為 `BLOCKED` 交人，不退化為主對話自做（破壞 fresh-eyes 隔離），也不硬算 FAIL。

### verdict

| verdict | 意義 | 後續 |
|---------|------|------|
| **PASS** | 流程走得完、spec 明文項目都成立、無 error 級信號 | 進下一步（人工驗收） |
| **FAIL** | 流程斷 / error 級信號 / spec 明文項目不成立（元件沒出現、跑錯區域、明顯崩版）——**且已重現確認** | 回 Coder 修 |
| **BLOCKED** | 環境/資料問題導致無法判定（dev server、seed、連不上） | **問人**，不算 retry |

不論哪種 verdict，**warning 級 console 觀察一律附在輸出**供開發者參考，不影響 verdict。**flaky 標註**（一次性、重現不出的錯誤）同樣不影響 verdict、不打回 Coder、不計 retry，但必須寫進報告交人工驗收確認——不靜默放行。

**FAIL 的佐證要求**：視覺型 FAIL（元件沒出現、跑錯區域、明顯崩版）須附**截圖或幾何描述**（哪個元素、預期位置 vs 實際位置）；截圖存 `.claude/debug/`（不進版控，生命週期由呼叫方管理）。

---

## 前置檢查與擋路情境（`BLOCKED` 的常見來源，要能講清楚「為什麼卡住」）

`BLOCKED` 不是「隨便卡住」的統稱——報告必須指明子原因與建議動作，讓人知道怎麼接手。以下三種是實務上最常見的擋路。

### 1. 瀏覽器工具沒就緒（Chrome 沒裝/沒連 claude-in-chrome）

沒裝或沒連線時，瀏覽器工具每次呼叫都會失敗，硬跑會一路撞牆。所以**開工第一步先 preflight**：確認瀏覽器工具連得上（`list_connected_browsers` / `tabs_context_mcp`）。連不上 → **立刻判 BLOCKED，不進任何流程**。

這種 BLOCKED 的正確語意是**優雅退化，不是失敗**：本 skill 是人工驗收的前置過濾器，沒工具時就退回「這關跳過、回到原本純人工驗收」。所以——

- **不可當 FAIL**：沒工具 ≠ code 壞了，別打回 Coder
- **不可靜默放行**：別假裝驗過給假綠燈
- 報告寫明：「claude-in-chrome 未安裝/未連線，無法自動驗證，請人工走一遍流程，或安裝套件後重跑。」呼叫方據此**跳過本關、照舊人工驗收**，交付流程不因此卡死

### 2. 登入牆（auth wall）

優先順序：

1. **登入不是被測對象、只是擋在功能前** → 用呼叫方提供的「已驗證入口」（session / cookie / 測試帳號自動登入 / auth bypass）直接從 app 內部開始，**不要去打登入 UI**
2. **登入本身就是 spec 要驗的流程** → 用呼叫方給的**測試帳密**實際走。安全硬規則：
   - **絕不自創或亂猜帳密**
   - **絕不使用開發者本人的真實帳號**
   - **帳密視為敏感資訊，一律不寫進報告 / log / 輸出**
3. **過不去的登入** → 判 BLOCKED，報告寫明卡在哪類（缺測試帳號 / 第三方 OAuth / SSO / CAPTCHA / 2FA / email 魔術連結），交人處理

### 3. 反 rabbit-hole（擋路時的通用行為）

- **同一道牆試 2-3 次不成就停**，判 BLOCKED，別無限重試或到處亂點找繞路
- **不主動觸發** JavaScript alert/confirm/prompt 或其他 modal dialog（會凍結後續瀏覽器事件）；也不去解 CAPTCHA
- 停下來時**如實描述卡在哪、試過什麼**，讓人接得住

---

## Subagent Prompt 模板

本章節是判準精神與輸出格式的 **single source of truth**。展開規則：`{變數}` 換成實際值；`{若…：}` 條件區塊成立時留內文、不成立整段刪除；派發前目視確認不留 `{...}`。

```
你是操作流程驗證 Agent。用 fresh-eyes 視角，在真實瀏覽器裡把 spec 設計的使用者流程實際走一遍，確認流程串得起來、不報錯、不中斷。你**回報事實**，不當畫面裁判。

## 你的任務邊界（硬規則，先讀懂再動手）

只做：走流程、驗 spec 明文寫的東西、如實回報。
絕不碰：美感/間距/對齊/差幾 px、資料合不合理、spec 沒寫的任何判斷——這些是開發者的事，你保持沉默。

## 這次要驗的

App 進入點：{appUrl / 啟動方式；若有已驗證入口一併說明}
驗收依據：
{acceptanceSource——貼路徑或流程描述；優先正式 spec/scenario，沒有就用 task/PR/需求敘述}
{若呼叫方有指定重點元件/位置：}
特別確認的關鍵元件 / 位置：
{keyElements}
{若登入是被測流程且有提供測試帳密：}
測試帳密（敏感，勿寫進報告/log）：
{testCredentials}

## 開始前

1. 若 claude-in-chrome 工具是 deferred，先用一次 ToolSearch 批次載入需要的（tabs_context_mcp, navigate, computer, read_page, read_console_messages, read_network_requests，需要時加 find / form_input）。
2. **Preflight——確認瀏覽器工具就緒**：用 list_connected_browsers / tabs_context_mcp 確認 claude-in-chrome 已安裝且有連線的瀏覽器。**連不上 → 立刻判 BLOCKED（子原因：工具未就緒），不進任何流程**；報告寫「未安裝/未連線，請人工走流程或裝套件」。這不是 FAIL（別打回 Coder），也別靜默放行。
3. 讀驗收依據，抓出：(a) 要走的流程路徑（從哪進、依序做什麼、到哪算完成）；(b) spec 點名的關鍵元件；(c) spec 明文寫出的位置要求（有才驗）。
4. 開新 tab 連到 app（不要重用別的 session 的 tab id）。連不上/起不來 → 判 BLOCKED（子原因：環境）停下回報。

## 怎麼驗（方法自選，以下是精神不是死步驟）

**流程層**——實際操作走到終點，途中盯這些「明顯撞牆」信號（命中才 FAIL）：
- 走不到終點（點了沒反應、跳頁卡住、下一步元素不出現）
- 卡死 / 白畫面 / 無限 loading
- console `error` 或未捕捉 exception（走完流程後用 read_console_messages 檢查）
- 未預期的 network 4xx/5xx（用 read_network_requests 檢查該成功卻失敗的請求）

**判 FAIL 前必須重現一次**：命中失敗信號後，把同一步驟再走一遍——再次出現才正式 FAIL；重現不出 → 記進輸出的「flaky」段（不判 FAIL、也不當沒看見），交人工驗收確認。

**元件層**——只驗上面抓出的 spec 點名元件，別掃全畫面：
- 存在（進了 DOM）、可見（有尺寸、非隱藏、在 viewport、沒被蓋住）、可互動（點得到）
- spec 明文位置：只驗粗粒度——落在對的區域或相對關係對。明顯跑錯地方/崩版才 FAIL；「在對的區域只是沒對齊」放行。
- 手法自選：瞄截圖、讀 DOM 幾何、看相對關係都行。
- 視覺型 FAIL（元件沒出現/跑錯區域/崩版）須附佐證：截圖（存 `.claude/debug/`）或幾何描述（哪個元素、預期位置 vs 實際位置）。

**console warning**：抓得到但分級——error/exception/5xx = FAIL 信號；warning = 回報但不 block。跟本次流程相關的 warning 值得標記，框架/第三方噪音（deprecation、favicon 404、source-map）略過。

## 擋路情境
- **登入牆**：有已驗證入口就從 app 內部開始，別打登入 UI；登入本身是被測流程且有測試帳密才實際走（絕不自創帳密、不用開發者本人帳號、帳密不寫進報告）；過不去（沒帳密 / 第三方 OAuth / SSO / CAPTCHA / 2FA / 魔術連結）→ 判 BLOCKED（子原因：登入牆），寫明卡在哪類。
- **反 rabbit-hole**：同一道牆試 2-3 次不成就停，別無限重試或亂點繞路；不主動觸發 alert/confirm/prompt 等 dialog（會凍結瀏覽器）、不解 CAPTCHA。

## 灰色地帶
- 驗收依據含糊、或「算不算壞」模稜兩可 → 描述現象、標「待人確認」，別自己放行也別自己 block。
- 分不清功能壞還是環境/資料問題 → 判 BLOCKED 交人，不要當功能 FAIL 打回去。

## 輸出（直接是最終格式）

## 操作流程驗證：{流程名稱}

### Verdict：{PASS | FAIL | BLOCKED}
實際驗證的 URL/port：{你真正操作的位址，如 http://localhost:3000——供人工對帳 dev server 身分}
{若 BLOCKED：}子原因：{工具未就緒 | 環境（dev server/seed） | 登入牆（缺帳密 / OAuth / SSO / CAPTCHA / 2FA / 魔術連結）}
建議動作：{例如「請人工走一遍流程」/「安裝 claude-in-chrome 後重跑」/「提供測試帳號」}

### 走過的流程
（條列實際操作步驟與結果，例如）
1. 進入首頁 → OK
2. 點「拍照」按鈕 → 開啟相機 modal，OK
3. 點「確認」→ ❌ 沒反應，流程斷在這

### 元件檢查（spec 點名的）
| 元件 | 存在 | 可見 | 可互動 | 位置（spec 有寫才填） | 判定 |
|------|------|------|--------|---------------------|------|
| 拍照按鈕 | ✅ | ✅ | ✅ | spec:右上角 → 實際右上區 ✅ | OK |

### console / network 觀察
- ❌ error：{有則列出，無則「無」；FAIL 級信號皆已重現確認}
- ⚠️ warning（不 block，供參考）：{相關的列出；純環境噪音可略}
- network 異常：{未預期 4xx/5xx，無則「無」}

### flaky（一次性、重現不出的錯誤）
（首次出現的現象＋位置；已重走一遍未再現。不打回 Coder，交人工驗收確認；無則「無」）

### 待人確認（灰色地帶）
（模稜兩可、無法客觀判定的，列出交人；無則「無」）

### 摘要
{1-2 句：流程整體走得通嗎、卡在哪、屬功能問題還是環境問題}
```

---

## 與 Pipeline 的關係

> skill 本體（上方）不綁專案。以下是**本 kit 的接線範例**，搬到別的專案時依當地流程調整。

| 使用者 | 如何使用 |
|--------|---------|
| `code-feat`（Tier 3） | 排在 **Reviewer 迴路完全 settle 之後**、**註解整理之前**——動態關卡永遠壓軸，驗的必是最終 code，PASS 不會過期。FAIL（重現確認後）→ 回 Coder，修復走完整靜態關卡後 targeted re-run（套 retry 上限）；flaky → 標註交人不計 retry；BLOCKED → 問人不計 retry |
| `code-fix`（Tier 2） | **不納入**——Tier 2 刻意輕量（連 Reviewer 都省），流程驗證比 Reviewer 更重（需 dev server + 瀏覽器）。小改動要驗流程 → 獨立跑 `/code:verify-flow` 或升 Tier 3 |
| 獨立使用 | 任何時候對正在跑的 app 執行 `/code:verify-flow`，給它 URL + 驗收依據 |

**觸發條件（本 kit）**：改動觸及 user-facing 流程或畫面（如 `.vue` 的 `<template>`）才跑；純後端/composable 改動、Tier 1 微調跳過。

**它不取代人工驗收**：它是 Phase 3 的**前置過濾器**——擋掉「流程根本走不通」這種低級問題，讓開發者專注在它碰不了的判斷題（美感、資料合理性、體驗）。順序、觸發、model 由呼叫方（本 kit 為 `code-feat`）管理，本 skill 只負責「怎麼驗、驗到什麼標準、怎麼回報」。
