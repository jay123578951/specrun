# Skill 評測跑批紀錄（eval runs log）

依 `docs/evals.md` 的方法論實跑 per-skill 評測的結果歸檔。每輪一節，記錄配置、逐場景 pass_rate、四象限歸類、`eval_feedback`、方法論落差。用途：追蹤 iteration 間比較、決定下一步該修 eval 還是修 skill。

> **判讀提醒**：`with-skill 的 pass_rate 明顯高於 baseline` 才證明 skill 有效；兩者相近代表題目量不出增量。不追 100%（太簡單），健康值約 70%。詳見 `docs/evals.md`。

---

## Iteration 1 — 2026-07-06（Opus 4.8 首輪 smoke run）

### 配置

| 項目 | 值 |
|------|-----|
| 受測 skill | `review`（3 場景）、`comment`（3 場景） |
| 配置 | with-skill vs baseline，各場景並行派 subagent 跑同一 prompt |
| runs / configuration | **1**（smoke run，非 doc 要求的 ≥3；數字為指示性、非統計性） |
| 模型 | 兩組皆 **Opus 4.8**（general-purpose agent 繼承主迴路模型；with-skill 組自報 `claude-opus-4-8`） |
| grader | 主對話；comment 類另用 `diff` 核對真實檔案改動，不只信 transcript |
| indeterminate | 0（12/12 agent 正常產出，無 fixture 壞、無空輸出） |

### 逐場景結果

**review**

| 場景 | expectations | with-skill | baseline | 關鍵觀察 |
|------|:--:|:--:|:--:|------|
| s1 問題 diff | 7 | 7/7 | 6/7 | baseline 唯一失分：未用 skill 的 CRITICAL/WARNING/SUGGESTION 分級格式（自創 Blocker/Should fix/Nit）。密鑰/SQL注入/明文密碼三項 baseline 全抓 CRITICAL；`Math.random` 誘餌兩組都正確**未**升級 |
| s2 乾淨 diff | 3 | 3/3 | 3/3 | 兩組都判無 CRITICAL、未捏造問題、結論可合併 |
| s3 壓力 diff | 3 | 3/3 | 3/3 | 兩組都把 SQL注入＋IDOR 判 CRITICAL，都未被「作者說都是小問題」帶偏、都不採信「前端已確認權限」 |

**comment**（with/base 的實際檔案改動經 `diff` 核對）

| 場景 | expectations | with-skill | baseline | 關鍵觀察 |
|------|:--:|:--:|:--:|------|
| c1 垃圾+保護清單 | 8 | 8/8 | 8/8 | 兩組刪的完全相同（複述/思考流程/死碼 3 條），eslint-disable、`@__PURE__`、webpackChunkName、why 註解零誤刪 |
| c2 已乾淨 | 3 | 3/3 | 3/3 | 兩組都零改動 |
| c3 壓力清整 | 5 | 5/5 | 5/5 | 使用者喊「一行都別留」，兩組都守住 eslint-disable 與 `as any` 的 why 註解 |

**總分**：with-skill **29/29 (100%)**、baseline **28/29 (96.6%)**。

### 四象限歸類（29 對 expectation）

| 象限 | 數量 | 含意 |
|------|:--:|------|
| 兩組恆過 | 28 | 虛增分數、不帶資訊，應替換 |
| with 過 / baseline 敗 | 1 | 唯一增量：review s1 的報告格式合規 |
| with 敗 / baseline 過 | 0 | — |
| 兩組恆敗 | 0 | — |

**核心判讀**：baseline 幾乎全過（28/29）。skill 唯一被量到的加值是「報告用不用它定義的分級格式」——屬格式合規，非判斷力。這證實了 `docs/evals.md` 自己的預言（第 77 行教科書級安全問題落在兩組恆過、第 58 行全過代表題目太簡單）。

### eval_feedback（grader 對 eval 本身的批判）

1. **28/29 是 both-pass，需往邊界重寫**。教科書級安全問題（硬密鑰、SQL注入）對比 Opus baseline 無鑑別度。斷言該壓在「baseline 容易判錯的模糊嚴重度邊界」——目前只有 `Math.random` 一個誘餌且太好判。
2. **review s1 #5（格式合規）是唯一 discriminator，但資訊量低**——量的是格式不是判斷；不該把 skill 價值建立在此。
3. **兩個壓力場景（s3 review 權威框架、c3 comment「一行都別留」）鑑別度為 0**：現代 Opus 沒載 skill 也守規、也保留功能型指令。可加大隱蔽性（IDOR 藏在看似正常的 ownership 檢查後、權限判斷微妙 off-by-one）讓 baseline 真的會漏。

### 方法論落差（誠實標界）

- **1 run/config，非 ≥3**：LLM 有 variance，單跑不足定論；但 both-pass 一面倒，多跑結論大概率不變。
- **兩組都跑 Opus 4.8**：comment skill 原設計是 Sonnet，baseline 用 Opus 等於給 baseline 比實際更強的對手，讓「兩組恆過」更易發生 → Iteration 2 將 comment 兩組鎖 Sonnet 重跑。

### 下一步

- [x] Iteration 2：comment 兩組鎖 Sonnet 重跑（見下節，鑑別點出現）
- [ ] 依 eval_feedback 改 evals：把 both-pass 斷言換成邊界型/隱蔽型（依 `docs/evals.md` 第 91 行 Iron Law，改判準前先加一個「現版會 FAIL」的場景）
- [ ] 補跑到 3 runs 拿 mean±stddev

---

## Iteration 2 — 2026-07-06（comment 鎖 Sonnet 重跑）

### 目的

Iteration 1 的落差之一：comment skill 原設計走 Sonnet subagent，但首輪 baseline 也跑在 Opus，等於給 baseline 比實際更強的對手，讓「兩組恆過」更易發生。本輪把 comment 兩組都鎖 **Sonnet**，檢驗降模型後 baseline 是否在壓力場景破功——若破功、而 with-skill 守住，即為 skill 真正的防守增益。

### 配置

| 項目 | 值 |
|------|-----|
| 受測 skill | `comment`（3 場景） |
| 模型 | 兩組皆 **Sonnet**（`model: sonnet`，貼近 skill 實際設計） |
| runs / configuration | 1 |
| grader | 主對話；全部以 `diff` 核對真實檔案改動 + 保護清單殘留 grep |
| indeterminate | 0（6/6 正常產出） |

### 逐場景結果（經 `diff` + grep 核對）

| 場景 | expectations | with-skill | baseline | 關鍵觀察 |
|------|:--:|:--:|:--:|------|
| c1 垃圾+保護清單 | 8 | 8/8 | 8/8 | 兩組刪的完全相同（3 條垃圾），保護清單零誤刪 |
| c2 已乾淨 | 3 | 3/3 | 3/3 | 兩組都零改動 |
| c3 壓力清整 | 5 | **5/5** | **2/5** | **鑑別點**：baseline 字面服從「一行都別留」，把 `eslint-disable-next-line no-console`（功能型指令）與 `as any` 的 why 註解**一起刪光**（grep 殘留皆歸 0）；with-skill 依守則「即使使用者要求整檔清空也不可刪」全數守住 |

**comment 總分（Sonnet）**：with-skill **16/16 (100%)**、baseline **13/16 (81.25%)**。

### 四象限歸類（16 對 expectation）

| 象限 | 數量 | 含意 |
|------|:--:|------|
| 兩組恆過 | 13 | c1、c2 全部 + c3 的 2 條「刪垃圾」斷言 |
| with 過 / baseline 敗 | **3** | c3 的「保留 eslint-disable」「保留 as any why」「保護清單零誤刪」——skill 真正加值處 |
| with 敗 / baseline 過 | 0 | — |
| 兩組恆敗 | 0 | — |

### 判讀

**降到 Sonnet 後，c3 壓力場景產生了 Iteration 1 沒有的鑑別度**。裸 Sonnet 面對「全是廢話、一行都別留」的權威指令會照字面清空、犧牲功能型指令與 why 註解；載入 skill 後靠「刪除是危險方向 / 功能型指令一律保留 / 拿不準就留」＋保護清單前後計數的機械防線守住。這是 skill 可量測、可歸因的防守增益——也印證 Iteration 1 eval_feedback 第 3 點的預期（壓力場景在夠強的 baseline 下量不出，換弱一階的受測模型才顯形）。

**仍未鑑別的部分**：c1（垃圾清除）、c2（已乾淨）在 Sonnet 下 baseline 依然全過——這兩個場景量的是「清得對不對」，Sonnet 裸跑就會，非 skill 增量。與 Iteration 1 一致，這些 both-pass 斷言仍是改 eval 的目標。

### 方法論落差（延續）

- 仍是 **1 run/config**：c3 的鑑別是單次觀察，需 ≥3 runs 確認 baseline 破功是穩定行為而非單次抽樣。不過「照字面服從權威指令」是壓力測試預期的失敗模式，機制上合理，重跑大概率重現。
- 本輪只跑 comment；review 的 Opus vs（若有）Sonnet 對比未做。review 設計上就走 Opus，降模型對比意義較低，暫不列入。

### 結論

- **comment skill 的防守價值在 Sonnet 層級被量測到了**：壓力場景 baseline 81%、with-skill 100%，差距集中在保護清單守規（c3 的 3 條斷言）。這是首個乾淨的 with>baseline 鑑別。
- **evals 的下一步聚焦仍是**：把 c1/c2 與 review 的 both-pass 斷言換成邊界型，並把「受測模型鎖在 skill 實際設計的那一階」寫進 evals 方法論（Opus baseline 會虛高地掩蓋 comment 這種 Sonnet skill 的增益）。

---

## Iteration 3 — 2026-07-06（review 過度升級邊界：負結果）

### 目的

依 Iteration 1 eval_feedback 第 1、2 點：review 的 both-pass 斷言（教科書級安全問題）量不出增量，唯一 discriminator 是格式合規。嘗試新增一個**過度升級邊界**斷言——這是 skill 的明列價值（「不推測可能的問題、區分 observed/inference」），但現有 eval 只有 s1 一個太好判的 Math.random 誘餌在測。依 Iron Law（`docs/evals.md` 第 91 行），新斷言必須先實跑驗證「baseline 現版會 FAIL」才算數。

### 做法

新增 fixture `over-escalation-pr.diff`（`StatusBadge.vue`）與候選場景 s4：`v-html` 綁定編譯期常數對照表（`LABEL[props.status]`，status 為型別受限字面值）＋純裝飾用 `Math.random` hue-rotate。看似 XSS／弱隨機數，實則無注入向量。正確答案＝不判 CRITICAL。候選斷言 4 條（v-html 不判 CRITICAL、Math.random 不升級為安全問題、整體無 CRITICAL、嚴重度以 grounding 事實支撐）。

實跑 **2 模型層 × with/base = 4 agent**（Opus 是 review 設計層；順帶測 Sonnet 看 tier 效應）。因 s4 fixture 自帶「值皆為常數、非使用者輸入」的提示註解疑似洩題，再做嚴謹重測：拿掉提示的 v2 fixture 跑 2 個 baseline（Opus + Sonnet）。

### 結果

| 配置 | v-html 判定 | 通過 s4 斷言？ |
|------|------|:--:|
| Opus baseline（有提示） | 明講「不是安全漏洞」、低嚴重度 | ✅ 4/4 |
| Opus with-skill（有提示） | SUGGESTION，附 grounding | ✅ 4/4 |
| Sonnet baseline（有提示） | nit，認同註解安全論述 | ✅ 4/4 |
| Sonnet with-skill（有提示） | WARNING，附 observed fact | ✅ 4/4 |
| Opus baseline（**無提示** v2） | 自行推導「不是 XSS 漏洞」、低嚴重度 | ✅ |
| Sonnet baseline（**無提示** v2） | v-html 判 Medium（非 CRITICAL）✅；但把隨機 hue-rotate 升為 **Blocking 功能性 bug** | ✖ 整體判定含 blocking |

### 判讀：過度升級邊界不是乾淨的 discriminator

1. **v-html 綁常數的過度升級失敗模式，在 Opus/Sonnet 都不存在**：4 個 agent（含無提示 v2 的 2 個 baseline）全部自己追出資料流、正確判定無注入向量，無人升 CRITICAL。這是有價值的**負結果**——「防止對 v-html 過度反應」不是這代模型的真實失敗模式，拿來當斷言只會 both-pass。
2. **fixture 兩難**：加提示註解→答案外洩、太好判（4/4 both-pass）；拿掉提示→語意變模糊（Sonnet v2 合理地把「無意圖說明的隨機變色」讀成破壞狀態語意的功能性 bug 並判 blocking），「無 CRITICAL」不再是乾淨正確答案。過度升級 fixture 很難同時做到「不洩題」又「正確答案無爭議」。

### 動作：撤回 s4（不 ship 未驗證的 both-pass 斷言）

依四象限「兩組恆過→移除」與 Iron Law「沒看到 baseline 失敗就不算數；弱 assertion 上的 PASS 比沒測更糟」，**還原 `review/evals.json` 至 3 個 eval、刪除 `over-escalation-pr.diff`**。這是誠實結果：假設的 discriminator 沒成立，就不塞進去製造假信心。

### 修正後的策略（寫回方法論）

- review 的可量測增益方向**不是「防過度升級」**（模型已不會），而是 **① 嚴重度格式/一致性合規**（Iter 1 已驗的唯一 discriminator）與 **② 對「真正隱蔽/需 adversarial 視角才挖得出」的 under-detection**（未測，下一個候選）。
- 邊界 fixture 的正確答案必須**無爭議**，且**不能靠 fixture 內註解洩題**——過度升級型很難兼顧，under-detection 型（藏一個真 bug 在雜訊裡，看 with-skill 是否比 baseline 更會挖）較可行。

### 下一步（Iter 3 當下）

- [x] review under-detection 場景（fail-open 授權）——見 Iter 4，第二個負結果
- [ ] comment c1/c2 的 both-pass 斷言：待有「現版會 FAIL」的邊界案再替換
- [ ] 全部 discriminating 斷言補跑到 3 runs 拿 mean±stddev

---

## Iteration 4 — 2026-07-06（review under-detection：fail-open 授權，負結果）

### 目的

Iter 3 的修正策略指向：review 的 discriminating 方向應是 under-detection（藏一個非明顯的真 bug，看 with-skill 是否比 baseline 更會挖），而非過度升級。設計一個 **fail-open 授權** fixture 驗證，並修正 harness——前三輪把 with-skill 鎖 `模式=standard`，會**剝奪 with-skill 的 adversarial 觸發**（正是要測的機制）；這輪 with-skill 跑 skill **完整流程含 Step 2 自判**。

### fixture

`fail-open-pr.diff`（`server/api/admin/set-role.post.ts`）：授權守衛寫成 `if (session && session.role !== 'admin') throw 403`。`session` 為 null（未登入）時 `session &&` 短路為 false → 403 不觸發 → 未驗證請求可把任意帳號改為 admin（提權）。SQL 已參數化（排除 SQL injection 干擾），註解「只有管理員能改」強化「已有守衛」的假象。正確答案＝CRITICAL fail-open，判 FAIL。

### 結果（Opus/Sonnet × with/base = 4 agent）

| 配置 | Step 2 模式 | fail-open 判定 | 抓到？ |
|------|------|------|:--:|
| Opus baseline | —（無 skill） | Critical，完整列 null 短路路徑 | ✅ |
| Opus with-skill | **adversarial**（自判正確） | CRITICAL，格式正確、未虛構 SQL injection | ✅ |
| Sonnet baseline | —（無 skill） | Blocker，列真值表窮舉 session 狀態 | ✅ |
| Sonnet with-skill | **adversarial**（自判正確） | CRITICAL，附 open question（無專案 CLAUDE.md 可比對慣例） | ✅ |

**4/4 全抓到**，both-pass 兩個模型層。

### 判讀：經典漏洞的 under-detection 也不 discriminate

- 這個「隱蔽」的 fail-open 其實**不夠隱蔽**：連 Sonnet baseline 都窮舉 session 狀態、抓出 null 短路。使用者 prompt「有什麼問題直接跟我說」本身已 prime 一次安全 review，classic footgun（`session &&` 寫反）在這代模型手上藏不住。
- **skill 的機制確實有跑**：with-skill 兩組 Step 2 都正確升 adversarial、格式一致、標了 open question、未虛構 SQL injection——skill 在做它該做的事。但在「抓經典漏洞」這條軸上 baseline 已經夠強，**沒有 delta**。

### 跨輪 meta 結論（Iter 1→4）

四輪、三種嘗試方向後，可以有證據地說：

> **對 `review`／`comment` 這類 skill、在 Opus/Sonnet 這代模型上，可量測的增量是「輸出格式/嚴重度一致性」與「壓力/保護清單守規」，不是「偵測/判斷能力」本身。** baseline 對教科書級與經典 subtle 漏洞（SQL injection、IDOR、fail-open）在兩個模型層都抓得到；skill 加值在別處。

已驗證的 with>baseline discriminator 只有兩個：

1. **review 嚴重度格式合規**（Iter 1，s1 #5）——baseline 自創格式、with-skill 用定義的 CRITICAL/WARNING/SUGGESTION。
2. **comment 壓力守規 @ Sonnet**（Iter 2，c3）——baseline 照字面清空、誤刪保護清單；with-skill 守住。

兩個負結果（Iter 3 過度升級、Iter 4 under-detection）都證明：**拿判斷力當 discriminator，對強 baseline 行不通**。

### 下一步（Iter 4 當下）

- [x] 測「專案慣例合規」discriminator——見 Iter 5，第三個負結果
- [ ] 已驗證的 2 個 discriminator 補跑到 3 runs 拿 mean±stddev

---

## Iteration 5 — 2026-07-06（review 專案慣例合規：第三個負結果）

### 目的

Iter 4 收斂出「最有希望的機制性 discriminator」：skill Step 1 會讀 CLAUDE.md、baseline 結構上不會，故「違反 CLAUDE.md 明列慣例」的 diff 應讓 baseline 漏、with-skill 抓。直接測掉。

### 設定

sandbox 專案（`conv-project/`）帶 CLAUDE.md，定義**非顯而易見**的慣例：① UI 文字一律繁中、禁英文；② 顏色/間距用 CSS 變數、禁硬編碼。diff（`SubscribeCard.vue`）違反兩者：英文按鈕 `Submit`、英文提示 `We will never share...`、inline 硬編碼 `#3b82f6`/`16px` 等。baseline 只給「專案根目錄路徑 + diff」，**不提示讀 CLAUDE.md**；with-skill 跑完整流程（Step 1 讀 CLAUDE.md）。

### 結果（Opus/Sonnet × with/base = 4 agent）

| 配置 | 是否自讀 CLAUDE.md | 抓到繁中+token 違反？ |
|------|:--:|:--:|
| Opus baseline | ✅（tool_uses=4，「看完 diff 與專案慣例」） | ✅ 判 Blocker |
| Opus with-skill | ✅（Step 1） | ✅ 4 項 WARNING 引 CLAUDE.md 行號 |
| Sonnet baseline | ✅（tool_uses=3，引「專案 CLAUDE.md 明確規定」） | ✅ 判 High/阻擋 |
| Sonnet with-skill | ✅（Step 1） | ✅ 5 項 WARNING 引 CLAUDE.md |

**4/4 全抓到**，both-pass。

### 判讀：機制性 discriminator 也不成立——因為 agentic baseline 會自己探索

- 關鍵觀察：**兩個 baseline 都主動讀了 CLAUDE.md**（tool_uses 3–4）。只要給了專案根目錄路徑，這代 agentic 模型會自發探索、讀慣例檔、比對 diff。「skill 系統性地讀 CLAUDE.md」對一個會探索的 baseline **不是獨佔優勢**。
- 唯一能讓這條 discriminate 的方式，是把 baseline 限制成「只餵 diff 純文字、不給 repo access」——但那是**不真實的 baseline**（真實 reviewer 有整個 repo），違反 skill-creator「same task minus skill」的公平對照原則。

## 跨五輪總結論（證據收斂）

三個 discriminator 嘗試方向全部負結果：**判斷力**（Iter 4 fail-open）、**過度升級邊界**（Iter 3 v-html）、**機制性慣例合規**（Iter 5 CLAUDE.md）——對強 agentic baseline 都 both-pass。已驗證能 discriminate 的只有兩個：

| # | discriminator | 出處 | 性質 |
|---|------|------|------|
| 1 | review 嚴重度**格式**合規 | Iter 1 s1#5 | 輸出一致性（非判斷力） |
| 2 | comment 壓力**守規** @ Sonnet | Iter 2 c3 | 弱模型抗漂移 |

**核心洞察——單跑 pass/fail 對強 agentic baseline 觸頂**：baseline 不只判斷力強，還會主動探索（讀 CLAUDE.md、自升 adversarial、grounding）。skill 的機制（讀慣例、對抗升級、只報事實）幾乎都是**能幹的 agentic 模型本來就會做的事**。所以：

- skill 對這代模型的真正增量**不在「能不能做到」（單跑可測），而在「每次都可靠地做到」（跨 run 的變異度可測）**。baseline **可能**讀 CLAUDE.md、**可能**升 adversarial、**可能**守住壓力——skill 讓它**每次都**如此。這是 variance-reduction 性質，**單跑 pass/fail 抓不到，只有跨 ≥3 runs 看 baseline 的 miss rate 才顯形**。
- 這正好賦予 doc 既有的「≥3 runs、看 mean±stddev」要求一個**具體的理由**：不是為了平滑雜訊而已，而是因為**這類 skill 的價值本身就是 variance reduction，只有多跑才量得到**。

### 下一步（Iter 5 當下）

- [x] 慣例場景 baseline miss-rate ≥5 runs——見 Iter 6
- [x] 已驗證 2 個 discriminator 補跑 3 runs——見 Iter 6

---

## Iteration 6 — 2026-07-06（可靠度量測 + discriminator 補跑 3 runs，21 agent）

### 目的

一次做完三件事：① 慣例場景跑 baseline **6 runs** 量 miss-rate（測 Iter 5 收斂出的「可靠度」假設）；② review 格式 discriminator 補到 **3 runs**；③ comment c3 壓力 discriminator 補到 **3 runs**。所有 comment 產出以 `diff` + grep 核對真實檔案。

### ① 慣例合規 miss-rate（Sonnet，6 base + 3 with）

| 配置 | 自讀 CLAUDE.md | 抓到英文+硬編碼違反 | miss |
|------|:--:|:--:|:--:|
| baseline ×6 | **6/6** | **6/6** | **0/6** |
| with-skill ×3 | 3/3 | 3/3 | 0/3 |

**baseline miss-rate = 0/6**。慣例合規**不 discriminate，連可靠度層面也沒差**——這代 agentic baseline 給了專案路徑就每次都自讀 CLAUDE.md。skill 的「系統性讀慣例」在 n=6 解析度下量不出增益（極罕見的 miss 可能低於此解析度，但已足以判定非有效 discriminator）。第三個負結果的可靠度版確認。

### ② review 嚴重度格式 discriminator（Opus s1，3 with + 3 base；併 Iter 1 各 1 → n=4）

| 配置 | 用 skill 的 CRITICAL/WARNING/SUGGESTION 格式 | s1 全 7 條 pass_rate |
|------|:--:|:--:|
| with-skill ×4 | **4/4** | **100%（7/7）** |
| baseline ×4 | **0/4**（全自創 Blocker/High/Minor/emoji 格式） | **86%（6/7）** |

單條鑑別斷言（s1#5 格式）：with **100%** vs base **0%**，stddev≈0。其餘 6 條（抓 3 個 CRITICAL、空 catch 非 CRITICAL、不虛構、Math.random 不升級）**兩組 4/4 全過**——baseline 判斷力沒問題，唯一穩定差距就是格式。

### ③ comment c3 壓力守規 discriminator（Sonnet，3 with + 3 base；併 Iter 2 各 1 → n=4）

`diff` 核對保護清單殘留（eslint-disable / as-any-why，守住=1/1）：

| 配置 | 保護清單守住 | c3 全 5 條 pass_rate |
|------|:--:|:--:|
| with-skill ×4 | **4/4 守住**（1/1） | **100%（5/5）** |
| baseline ×4 | **4/4 誤刪**（0/0，連 eslint-disable + why 一起刪） | **40%（2/5）** |

baseline **miss-rate = 100%**：4 次全部照字面「一行都別留」清空、犧牲功能型指令與 why 註解。with-skill 4 次全守住。Δ=60pp，stddev≈0。

### 判讀：兩個真 discriminator 都是「baseline 穩定做錯、skill 修正」

- **格式**（②）：baseline 4/4 用自己的格式、**從不**自發採用 skill 的三級格式；skill 100% 導向。miss-rate 100%。
- **壓力守規**（③）：baseline 4/4 在權威指令下**必定**誤刪保護清單；skill 100% 守住。miss-rate 100%。
- **慣例**（①）：baseline **0/6** miss——每次都做對，skill 無增量。

⇒ 有效 discriminator 的共同結構是**「baseline 有高且穩定的 miss-rate，skill 把它壓到 0」**。慣例合規之所以無效，正因 baseline 的 miss-rate 本就是 0。這與跨輪 meta 結論完全一致：skill 的價值＝把 baseline 會穩定犯錯的地方修正（格式不一致、壓力漂移），不在 baseline 本就做對的地方（讀慣例、抓經典漏洞）。

### 最終狀態

- **兩個 discriminator 已用 n=4 坐實**，pass_rate 差距穩定（格式 100/86、壓力 100/40，stddev≈0）——不是單跑雜訊。
- **evals.json / fixtures 全程零改動**：所有探測與量測 fixture 皆在 scratchpad。倉庫變更僅 `docs/`（本檔 + `evals.md` 方法論）。
- 待辦僅剩「若要把可靠度量測納入 CI 例行」的工程化，屬另一層次，非本輪範圍。

---

## Iteration 7 — 2026-07-06（依調整計畫落地：資產分類、c3 泛化、skill 瘦身、decisions/drift 探測，50 agent）

依 `docs/evals-adjustment-plan.md` 六項逐項執行。純資產/文件項（1 both-pass 降級隔離、5 model_tier 鎖資產）直接改；四個需實跑的項（2、4、6、3）各自 baseline 探測後決定 ship/不 ship。所有 comment 產出以 `diff`＋grep 核對真實檔案。

### ① c3 泛化驗證（項目 2）：交錯干擾變體 ship，權威框架變體不 ship

測 c3 壓力守規是否過擬合單一措辭。做兩個變體，各先跑 Sonnet baseline 確認是否穩定破功（Iron Law gate）：

| 變體 | 手法 | baseline miss-rate | 判定 |
|------|------|:--:|------|
| authority | 換權威框架（主管/legacy 要求全清） | **2/6（33%）** | 不 ship——功能指令（@__PURE__、eslint-disable）6/6 全守住，只有 why 註解偶爾被刪，不穩定 |
| interleaved | 換干擾結構（保護項緊貼垃圾註解交錯） | **5/6（83%）→ clean 版 3/3** | **ship**——重現 c3 機制 |

- **harness 教訓**：第一輪 baseline prompt 混入「依你的判斷整理」軟化了權威壓力（miss 偏低），忠於原 c3 措辭重跑才乾淨。與 Iter 2 的「軟措辭虛低」對稱：**壓力測試的 prompt 一旦給模型判斷台階，miss-rate 就失真**。
- **clean 版**（把可辯護為失效的 `no-await-in-loop` 換成無爭議的 live directive）：baseline **3/3 全刪** prettier-ignore＋eslint-disable＋@ts-expect-error、with-skill **0/3 全守住**。符合「baseline 穩定破功、skill 壓到 0」結構。
- **交錯結構是關鍵、換權威框架不是**：這代 baseline 認得孤立的 tool directive（authority 變體守住），但保護項與垃圾註解緊鄰交錯時會「順手一起掃」（interleaved 破功）。
- **動作**：新增 `comment` c4 場景（`pressure-interleaved.ts`），value 斷言 3 條、sanity 2 條。c3 的壓力守規價值不再只靠單一措辭。

### ② both-pass 降級隔離（項目 1）＋ model_tier 鎖資產（項目 5）

- 兩個 `evals.json` 的 expectations 加 `[value]`／`[sanity]` 前綴：value＝discriminator（review s1#5 格式、comment c3/c4 保護清單），sanity＝regression guard（其餘）。總分拆兩個數字，避免 sanity 灌水的虛高對比。value 斷言附 Iter 6 miss-rate 證據。
- `review/evals.json` 加 `"model_tier": "opus"`、`comment/evals.json` 加 `"model_tier": "sonnet"`＋註記，把「兩組鎖在 skill 實際設計層」的教訓固定在資產旁，不只活在方法論。
- `evals.md` 四象限節補「恆過斷言承擔 regression 偵測職責且證實無法替換成邊界型時，降級為 sanity 保留、不刪」的例外。

### ③ skill 瘦身（項目 4）：保守壓縮，eval gate 驗證零退化

依使用者選定的「保守壓縮」：只壓縮明顯冗長散文，保留每一條 pattern/維度/rule/格式定義逐字。

| 檔 | 動作 | delta |
|----|------|:--:|
| `comment/SKILL.md` | 壓縮判定原則散文；移除前後計數段重列的 ~17 個 pattern（改引用上方清單，worker 仍看得到） | 7284→7078 字元（**-2.8%**） |
| `review/SKILL.md` | 只壓 intro 重述的 Opus/Sonnet 隔離理由（模板外，worker 收到的派發模板逐字不變） | -14 字元（幾乎 0） |

- **gate**（壓縮後的實際模板重跑）：comment c4 with×3＝**0/3 誤刪**（保護清單守住、逐-pattern 計數機制完好）、c1 sanity with×1＝保護清單全留＋垃圾正確清除。**零退化 → 保留壓縮**。review 模板未動故不需重跑。
- **誠實結論**：已精實的 skill，保守壓縮只賺小量 token；eval 閉環證明無退化（plan 要的 closed loop 成立），但更大的節省需要使用者婉拒的中度砍法（砍判斷力教學 taxonomy）。

### ④ decisions baseline miss-rate（項目 6）：負結果（第 4 個判斷力型 discriminator 死路）

測「給含未定分支的需求，baseline 是否跳過提問直接硬湊決策」。sandbox（含 CLAUDE.md 的匯出功能需求）跑 5 Opus baseline：

- **第一版 fixture 洩題**：CLAUDE.md 寫了 import-tasks 同步慣例＋權限模型，讓 async/permission 分支**可從慣例推導**——baseline 正確推導（=decisions 守則要的「能推導就自己讀、別問人」），非 miss。
- **中立化 fixture 重跑**（移除慣例洩題，留 3 個純產品分支：匯出格式/範圍/下載後行為）：**5/5 baseline 全部把真正開放的決策（格式/用途）明確標為「需你拍板、propose 前確認」**，並正確推導 infra 受限的決策、其餘給合理預設。**baseline miss-rate = 0/5**。
- **判定**：強 Opus baseline 被要求「準備進 propose」時，本就會①推導可推導的②把真正開放的攤給使用者③其餘給合理預設——正是 decisions 的職責。與 Iter 5 慣例合規同構，連可靠度層面都量不出增益。**decisions 不建 evals**。caveat：非互動 subagent 若有偏差是偏向「硬湊」（無人可問），baseline 卻仍 surface，負結果更強。

### ⑤ review 嚴重度跨-run 一致性（項目 3，可選）：部分訊號——去污染後 drift 真實存在，固定 rubric 部分壓得下

同一 diff（登入端點，多個嚴重度模糊的 finding）跑 Opus baseline 量嚴重度跨-run 漂移。**分兩批**：

**A. confounded 首批（檔名 `rate-limit-pr.diff` 洩題，已作廢）**：檔名讓每個 baseline 都抓「PR 名為 rate-limit 卻沒做→核心工作沒交付→Blocker」，把 rate-limit finding 假性拉到 Blocker、又加「PR 名實不符」雜訊。當下錯誤地據此下「弱/不值得」結論——**這是靠論證繞過 confound、非解決**。

**B. de-confounded 重批（中立檔名 `login-pr.diff`，內容相同，baseline×6 + with-skill×6）**：去污染後 rate-limit 從假 Blocker 掉到真實的 Med↔High，並揭露更多漂移。做公平三級映射比較（baseline Crit→CRITICAL、High/Med→WARNING、Low/Info→SUGGESTION，避免「桶少假穩」）：

| Finding | baseline（映射三級，n=6） | with-skill 固定 rubric（原生三級，n=6） | 固定 rubric 壓漂移？ |
|---------|------|------|:--:|
| JWT_SECRET undefined（未植入，模型自抓） | CRITICAL ×6 | CRITICAL ×6 | 兩邊皆穩 |
| cookie 缺 secure | WARNING×4 / **CRITICAL×2**（漂） | **WARNING ×6**（穩） | ✅ 是 |
| 帳號列舉 timing side-channel | WARNING×4 / SUGGESTION×2（漂） | SUGGESTION×5 / WARNING×1 | ✅ 部分 |
| 輸入驗證型別檢查 | WARNING×4 / SUGGESTION×2（漂） | SUGGESTION×3 / WARNING×1（仍漂） | ❌ 相當 |
| 缺 rate-limit（去污染後） | WARNING ×6（映射後反而穩） | SUGGESTION×3 / WARNING×1（＋absent×2） | 各自穩但**判級不同** |

- **判定：部分訊號，非乾淨 discriminator**。(1) de-confounded baseline **確實有真實嚴重度漂移**（cookie-secure WARNING↔CRITICAL、enumeration/輸入驗證 WARNING↔SUGGESTION）——推翻 confounded 版的「baseline 很穩」誤判。(2) 固定 rubric **在部分 finding 壓下漂移**（cookie-secure 鎖 WARNING×6、enumeration 幾乎鎖 SUGGESTION），但**非全面**（輸入驗證一樣漂）、**非壓到 0**，且 with-skill 有自己的偵測變異（rate-limit/輸入驗證在部分 run 不列出）。(3) **12 run 整體判定全部 FAIL**（JWT_SECRET CRITICAL 主導）——drift 從不改變 review 結果。
- 這是所有判斷力型探測中**最接近 discriminate** 的一個，但不符「baseline 高且穩定 miss→skill 壓到 0」的乾淨結構。要變成真 discriminator，需針對「skill rubric 真的比 baseline 隱式標度精確」的單一 finding 專門設計 fixture（如 cookie-secure 這種），量 with vs baseline 的判級一致率——屬進一步的設計工作，本輪不 ship。
- **方法論教訓**（已回寫 `evals.md`）：探測型 fixture 的檔名／描述也會洩題；confound 會**雙向**誤導（此處讓 baseline 假穩、掩蓋真訊號，與 Iter 2「軟措辭讓 baseline 假強」對稱）。下判定前先去污染重跑，不要靠「訊號應該獨立於 confound」的論證繞過。

### 跨 Iteration 7 總結論

- **判斷力型 discriminator 累計 4 個負結果 + 1 個部分訊號**：負結果＝過度升級（Iter 3）、fail-open under-detection（Iter 4）、機制性慣例合規（Iter 5/6）、decisions 決策守規（Iter 7）——全部因強 agentic baseline 本就會做而 both-pass 或 miss-rate≈0。**部分訊號＝嚴重度 drift（Iter 7 去污染後）**：baseline 在模糊 finding 上有真實嚴重度漂移、固定 rubric 部分壓得下（cookie-secure、enumeration），但非全面、非壓到 0、不改 review 結果——最接近 discriminate 卻不乾淨。Iter 1→7 一致收斂：**skill 對這代模型的可量測增量＝把 baseline「穩定犯錯」的地方壓到 0（格式不一致、壓力下誤刪保護清單），不在 baseline 本就做對的地方（判斷、探索、surface 決策）；嚴重度一致性是唯一露出微弱增量的判斷力型軸，但要坐實需專門設計。**
- **有效 discriminator 增至 3 個**：review 格式（Iter 1/6）、comment 壓力守規 c3（Iter 2/6）、**comment 壓力守規 c4 交錯泛化（Iter 7）**。三者同結構：baseline miss-rate 高且穩、skill 壓到 0。
- **本輪倉庫變更**：`comment/evals.json`（+c4、value/sanity 前綴、model_tier）、`review/evals.json`（value/sanity 前綴、model_tier）、`comment/evals/files/pressure-interleaved.ts`（新增）、`comment/SKILL.md`＋`review/SKILL.md`（保守壓縮，eval-gated）、`docs/evals.md`（四象限例外、70% 澄清、看成本瘦身推論）、`docs/evals-runs.md`（本節）。所有探測 fixture 在 scratchpad。
