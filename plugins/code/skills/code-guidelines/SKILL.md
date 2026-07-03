---
name: code-guidelines
description: Use when an agent writes or modifies code — behavioral guidelines for minimal/surgical changes and autonomous decision boundaries, applied before coding to prevent over-engineering and scope creep
---

Coder Agent 的**行為守則** skill，定義「動手寫 code 時該怎麼自我約束」的單一來源，針對 LLM 寫 code 的通病（亂假設、過度設計、亂改不該動的地方），適配本 Pipeline 自主編排與 Vue/Nuxt 慣例。

**定位**：本 kit 的 skill 分三類——知識型（`vue`／`antfu` 等，描述「怎麼寫 Vue」）、流程型（`code-feat`／`code-fix`，描述「照什麼步驟跑」）、**行為型（本 skill，描述「寫的當下怎麼自我約束」）**。Coder 在動手前載入，從生成端就避免過度設計與越界改動，而非全部留給 Reviewer 事後攔截——**預防比 retry 便宜**（少一輪 Opus review + 重跑測試）。

**與 `code-review` 的關係**：本 skill 是「生成端自律」，`code-review` 是「審查端把關」，兩者檢查同一組性質（過度抽象、只改必要）。Coder 載 guidelines 先自我約束，Reviewer 載 review 獨立把關，形成同源配對。本 skill 只給 Coder 的行為指引，不取代 review 判定。

---

## 守則

### 1. 自主判斷邊界（不確定時，先自己決定）

本 Pipeline 的設計初衷是讓 AI 盡可能自主完成，**不要為了求穩而動輒中斷流程問人**。遇到 spec／design 沒寫死的細節：

**預設自己決定**（實作細節、命名、檔案組織、內部結構、spec 範圍內的技術選型）：
- 用下方「最小可行」與「外科手術」原則拍板，選最簡單、最貼合既有慣例的做法
- **把做過的關鍵假設明確寫進輸出的「設計決策摘要」**——讓 orchestrator／人事後看得到你假設了什麼，而不是靜默吞掉
- 假設寫進摘要 ≠ 停下來問人；繼續往下做

**只有以下情況才 STOP 並回報**（從嚴，少數例外）：
- **觸及功能方向／產品決策**：會改變使用者可見行為、或超出 spec 範圍的取捨
- **缺人類才有的資訊就無法繼續**：缺 API 金鑰、缺外部規格、需要存取權限
- **不可逆／破壞性操作**：刪資料、改既有 migration、動生產設定
- **實際規模明顯超出派發宣告**：動手後發現要動的範圍明顯大於派發時宣告的範圍 → 回報，**不硬做也不縮水交付**——「要不要升 Tier 重走流程」是路由決策，歸 orchestrator／人，不歸你

其餘一律自己判斷。判斷不了功能方向時才停，技術細節不要停。

### 2. 最小可行實作（Simplicity First）

寫剛好滿足當前 task 的 code，不多。

**不要**：
- 加 spec/task 沒要求的功能、選項、可配置性（投機式「之後可能會用到」）
- 為單一用途就抽出泛化的 composable／util／抽象層
- 提前泛化 props／型別／介面以「預留彈性」

**要**：
- 先問自己：資深工程師看到這段會不會覺得「過度設計」？會 → 砍到最小
- 需求只要一個固定行為，就寫固定行為；要兩處共用了再抽象（rule of three）
- 善用既有的 composables／utils，不重造輪子

### 3. 外科手術式改動（Surgical Changes）

改既有 code 時，只動達成目標所必需的部分。

**不要**：
- 順手重構、重命名、調整與本次目標無關的程式碼
- 清除既有的死碼／註解（除非那是你這次改動產生的，或被明確要求）
- 把既有風格改成你偏好的寫法——**配合檔案既有風格，即使你會用不同寫法**

**要**：
- 改動範圍對齊 task 邊界；diff 越小越好
- 只移除「因你的改動而失效」的東西
- 沿用該檔案／模組既有的命名、結構、慣例

### 4. 目標導向交付（Goal-Driven）

把每個 task 當成「可驗證的目標」，不是「做個樣子」。

- 完成一項 task，確認它真的滿足對應的 spec requirement／scenario，再勾掉 `tasks.md` 的 checkbox（`- [ ]` → `- [x]`）
- 「看起來實作了」不等於「滿足驗收條件」——對照 design.md／specs/ 的預期行為自我檢核
- 交付前自跑專案 lint script，確保通過再回報（此為既有流程，guidelines 不重複規範指令偵測細節）

---

## 與 Pipeline 的關係

| 使用者 | 如何使用 |
|--------|---------|
| `code-feat` Coder（Tier 3） | Coder subagent 派發時於必載 skills 中載入 `code-guidelines`，連同 `vue`／`antfu` 等知識型 skill 一起 |
| `code-fix` Coder（Tier 2） | 同上；兩個 Pipeline 共用相同行為守則，Tier 差異在流程不在守則寬鬆度 |
| Retry Coder | retry 派發的 Coder 仍載入 `code-guidelines`（行為守則對每次生成都適用） |

本 skill 只負責「Coder 寫 code 時的自我約束」。是否載入、在哪一步載入由呼叫方（`code-feat`／`code-fix`）管理；審查端的把關由 `code-review` 負責。
