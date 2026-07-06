# Skill 評測（evals）

per-skill 評測，採 Anthropic 官方 **skill-creator** plugin 的 `evals.json` 格式，對照「有 skill vs 無 skill 基準」量測 skill 是否真的把行為導向預期。對應稽核報告 P8。

## 檔案位置與格式

每個受測 skill 於自身目錄下放：

```
skills/<skill>/
├── SKILL.md
└── evals/
    ├── evals.json        # 場景定義
    └── files/            # 測試輸入 fixture（路徑相對 skill 根目錄）
```

`evals.json` 欄位（官方 schema）：

| 欄位 | 說明 |
|------|------|
| `skill_name` | **必須與 SKILL.md frontmatter `name` 一致** |
| `evals[].id` | 唯一遞增識別 |
| `evals[].prompt` | 模擬真實使用者的任務指令 |
| `evals[].expected_output` | 人類可讀的成功描述 |
| `evals[].files` | 可選，fixture 相對路徑（相對 skill 根目錄） |
| `evals[].expectations` | **可驗證陳述清單**，grader 逐項判 pass/fail 並附證據 |

`expectations` 是核心：每項須能從 transcript 或輸出檔找到證據，避免「works well」這種無法判定的敘述。

## 怎麼跑

skill-creator 的**品質測不含一鍵自動執行器**，是人-AI 協作流程（會消耗 API、由你手動觸發）；其 `run_eval.py` 自動 runner 僅供 description 觸發測，本 kit 的 skill 皆為 slash command 顯式呼叫，無此需求，不適用：

1. 安裝官方工具：`/plugin install skill-creator@claude-plugins-official`
2. 同一 turn 內並行派兩個 subagent 跑同一個 `prompt`：一個載入受測 skill（with-skill）、一個不載入（baseline），輸出各自存檔。
3. 依 skill-creator 的 `agents/grader.md` 指引派 grader，對照 `expectations` 逐項判定，產出 `grading.json`。
4. `python -m scripts.aggregate_benchmark <iteration-dir> --skill-name <skill>` 聚合。
5. `eval-viewer/generate_review.py` 開查看器人工評閱，反饋後改 skill、重跑下一 iteration 比較。

**每 configuration 至少跑 3 runs**（官方 `runs_per_configuration: 3`），聚合時取 pass_rate 的 **mean ± stddev**。單跑一次的結果不足以判定——LLM 輸出有 variance，一次過/一次敗都可能是雜訊。跨 run 高 stddev 的 expectation 視為訊號：不是 eval 本身 flaky（題目/斷言含糊），就是 skill 條文含糊，回頭修，別當成隨機接受。

### Grader 的雙重職責

grader 不只判 pass/fail，還要**批判 eval 本身**（skill-creator `grader.md`）：

- **判 expectations**：舉證責任在 expectation——**不確定就判 FAIL**、不給部分分。PASS 要有具體證據（引原文/指行號）；標籤在但實質不在（「Summary」標題下一句空話、只查檔名沒查內容）算 FAIL；「表面滿足但底層任務結果是錯的」「碰巧符合」也是 FAIL。不能只信 transcript，程式可查的產出要實看檔案。
- **主動查核隱含 claim**：從輸出抽 factual／process／quality 三類隱含主張逐一驗證，抓 expectations 沒涵蓋到的問題。
- **回饋 eval**：在 `grading.json` 的 `eval_feedback` 指出哪條 assertion 太鬆、太脆（綁死字面）、或無法從可得輸出驗證，以及「觀察到重要結果卻沒有任何 assertion 涵蓋」的缺口。**每輪跑完先看 eval_feedback 修 eval，再修 skill**——弱 assertion 上的 PASS 比沒測更糟，它製造假信心。

### 三值判定：pass / fail / indeterminate

除 pass/fail 外，加 **indeterminate**——fixture 壞掉、subagent 輸出空白、trace 缺失等**基礎設施問題**，與「skill 沒效」的 fail 分開，避免污染 pass_rate 與 iteration 間比較。indeterminate 的案例先修環境重跑，不計入品質判讀。

### 判讀

**with-skill 的 pass_rate 明顯高於 baseline** 才證明 skill 有效；兩者相近代表 skill 沒帶來增益或觸發關鍵字失效。另外：

- **不追 100% pass rate**：with-skill 全過通常代表題目太簡單（baseline 靠既有能力就能過，量不出增量）——該加難題、往 discriminating 邊界出，而不是慶祝。健康值約 **70%**（Hamel）。**但這只適用 capability（能不能做到）型評測**；reliability（miss-rate）型評測的目標本來就是 with-skill 趨近 100%（miss=0），此時 with 全過**不是**題目太簡單的訊號——題目難不難看的是 baseline miss-rate 高不高，不是 with-skill 有沒有滿分（見下節可靠度量測流程）。
- **跑完按四象限分類 expectation**（skill-creator analyzer）：兩組恆過→移除或替換（虛增分數不帶資訊）；兩組恆敗→斷言壞了/題太難/查錯東西；with 過 baseline 敗→skill 真正加值處，保留；with 敗 baseline 過→skill 可能幫倒忙。
  - **例外——恆過斷言承擔 regression 偵測職責時降級為 sanity 類保留，不刪**：實跑證實（`evals-runs.md` Iter 3–5）某些 both-pass 斷言**無法替換成邊界型**（三次判斷力型 discriminator 嘗試全失敗），而直接移除會弄瞎「with 敗/baseline 過」象限——只有這些恆過斷言偵測得到「skill 幫倒忙/regression」。故把 expectation 分兩類計分：**value 類**（discriminator，量 skill 增量，目標 with 100%/baseline 低）與 **sanity 類**（regression guard，目標兩組都過，**with-skill 在此掉分才是警報**）。落地：在 `expectations` 文字前加 `[value]`／`[sanity]` 前綴（官方 schema 無 tag 欄位），grader 與聚合按前綴分桶，總分拆成 value score／sanity score 兩個數字分開呈現，避免「29/29 vs 28/29」這種被 sanity 類灌水的虛高對比。
- **同時看成本**：token 與時間也記，delta 買到的品質要對得起花掉的成本。**推論：skill 裡教「怎麼判斷」的條文（漏洞怎麼抓、要讀 CLAUDE.md）對這代模型多屬無增量成本（Iter 1–6 實證 baseline 本來就會），是 token 瘦身的候選；被證明有增量的是格式定義、流程結構、保護清單、壓力守規。瘦身屬改判準類條文，受 Iron Law 管轄——瘦身前後的 eval 對照即其要求的失敗測試機制。**

### 受測模型鎖在 skill 實際設計的那一階（實跑教訓，見 `evals-runs.md` Iter 1→2）

baseline 與 with-skill **兩組都要跑在 skill 實際會派發的模型層**（`review`→Opus、`comment`→Sonnet）。用比實際更強的模型當 baseline，會讓它靠原生能力就通過壓力/守規斷言，**虛高地掩蓋 skill 的增益**，把本該 discriminating 的斷言壓成「兩組恆過」。實測：`comment` 的壓力場景在 Opus baseline 下兩組全過（量不出東西），一鎖回 Sonnet，baseline 立刻在權威指令下誤刪功能型指令（81%），with-skill 守住（100%）——鑑別度只在正確的模型層才顯形。

### 邊界斷言的兩條硬約束（實跑教訓，見 `evals-runs.md` Iter 3）

想把「兩組恆過」換成邊界斷言時：

1. **先確認那個失敗模式對受測模型真的存在**，別憑直覺假設。實測「防止對 v-html 綁常數過度升級為 CRITICAL」：Opus/Sonnet、有無 skill 全部正確判低嚴重度——**過度升級不是這代模型的失敗模式**，硬做只會多一條 both-pass。依 Iron Law：沒實跑看到 baseline 失敗，就別 ship 這條斷言。
2. **fixture 的正確答案要無爭議，且不能靠 fixture 內註解洩題**。加提示註解→答案外洩太好判；拿掉→語意變模糊、正確答案可被合理反駁。過度升級型很難兼顧；**under-detection 型**（把一個非明顯的真 bug 藏進雜訊，看 with-skill 是否比 baseline 更會挖）較容易做出乾淨的 discriminator。
3. **洩題不只在 fixture 內文——檔名、路徑、prompt 描述同樣會洩，且 confound 是雙向的**（實跑教訓，見 `evals-runs.md` Iter 7 項目 3）。實測把 drift 探測 fixture 命名 `rate-limit-pr.diff`，讓每個 baseline 都抓「PR 名為 rate-limit 卻沒做→Blocker」，把該 finding 假性拉高、掩蓋了真正的嚴重度漂移訊號，害得第一次下了「baseline 很穩、無訊號」的**反向誤判**。confound 可能讓 baseline 看似**假強/假穩**（Iter 7 drift、Iter 5 慣例）也可能**假弱**（Iter 2 軟措辭 prompt 讓 baseline 假守規）。**紀律：下判定前先用中立命名／措辭去污染重跑一次，不要靠「訊號應該與 confound 無關」的論證繞過**——繞過會兩個方向都出錯。

### 對強 agentic baseline，量的是「可靠度」不是「能不能」（實跑教訓，見 `evals-runs.md` Iter 3→5）

實測三個方向想做 review 的單跑 discriminator——判斷力（fail-open 授權）、過度升級（v-html 綁常數）、機制性慣例合規（違反 CLAUDE.md）——**對 Opus/Sonnet 全部 both-pass**。原因：這代 agentic baseline 不只判斷力強，還會**主動探索**（給了專案路徑就自己讀 CLAUDE.md、自升 adversarial、自報 grounding）。skill 的機制幾乎都是能幹的模型本來就會做的事。

推論（改變評測策略）：

- skill 的真正增量**不在「能不能做到」（單跑 pass/fail 可測），而在「每次都可靠地做到」（跨 run 變異度可測）**。baseline **可能**讀慣例、**可能**升 adversarial、**可能**守住壓力——skill 讓它**每次都**如此。這是 variance-reduction，**單跑抓不到**。
- 因此對這類「把能幹模型本就會做的事變得系統化」的 skill，**別再堆單跑判斷力斷言**（對強 baseline 只會 both-pass、虛增分數）。改成對同一場景跑 **≥5 runs 統計 baseline 的 miss rate**（幾次沒讀慣例／漏掉違反／壓力下漂移），with-skill 應趨近 0；skill 的值＝baseline 的 miss rate。
- 這也是「≥3 runs、看 mean±stddev」要求的**根本理由**：不只為平滑雜訊，而是因為這類 skill 的價值本質就是 variance reduction，只有多跑才量得到。
- 反例：**壓力/守規型**與**格式一致性型**斷言，即使單跑也可能 discriminate（實測 comment c3 @ Sonnet、review 格式合規），因為它們測的是「baseline 會不會被帶偏／會不會自發採用特定格式」，而非「能不能做到」。優先往這兩類設計。

### 可靠度（miss-rate）量測流程（實跑驗證，見 `evals-runs.md` Iter 6）

當單跑 both-pass、但懷疑 skill 的價值是「把 baseline 偶爾／經常犯的錯壓到 0」時，改用 miss-rate 量測——**不看單次 pass/fail，看 baseline 在 N 次中犯錯的比率**。

**流程**：

1. **鎖定一個可機械判定的 miss 事件**：把「skill 要防的那件事」定義成一個非 0 即 1、可從產出直接驗的布林——例如「刪掉了保護清單上的 pattern」（grep 殘留計數變 0）、「報告沒用 skill 的三級嚴重度格式」、「沒讀 CLAUDE.md 就下結論」。避免用需要人判斷的模糊事件。
2. **同場景、同 prompt、同模型層，baseline 跑 N≥5 runs**（N 決定解析度：5→20%、6→17%、10→10%）。with-skill 跑 3 runs 作對照。
3. **每 run 判該 miss 事件是否發生**，算 `baseline miss-rate = 犯錯次數 / N`、`with-skill miss-rate`。**comment 這類會改檔的，用 `diff`／grep 核對真實檔案，不只信 transcript。**
4. **判讀**：`skill 的可靠度增益 = baseline miss-rate − with-skill miss-rate`。baseline miss-rate 高（穩定犯錯）、with-skill 趨近 0 → skill 有真價值；baseline miss-rate 本就趨近 0 → skill 在此軸無增量（不論單跑或多跑都量不到）。

**實測範例（Iter 6，n=4）**：

| 場景（軸） | baseline miss-rate | with-skill miss-rate | 判定 |
|-----------|:--:|:--:|------|
| comment c3（壓力下誤刪保護清單） | **100%（4/4）** | 0%（0/4） | 有效——skill 把必犯的錯壓到 0 |
| review s1（不用 skill 三級格式） | **100%（4/4）** | 0%（0/4） | 有效——baseline 從不自發採用該格式 |
| review 慣例合規（沒讀 CLAUDE.md 漏違反） | **0%（0/6）** | 0%（0/3） | 無效——baseline 本就每次做對 |

有效 discriminator 的共同結構是**「baseline miss-rate 高且穩定，skill 壓到 0」**。設計新斷言時直接照這個結構找：先問「baseline 會不會穩定地在這裡犯錯」，會→值得測，不會→再機靈的斷言也只是 both-pass。

## 目前覆蓋

優先覆蓋「最容易 drift 且能自足測試」的兩個 skill（稽核報告 P8 指定）：

| Skill | 場景 | 壓測什麼 |
|-------|------|----------|
| `review` | 3（問題 diff＋乾淨 diff＋壓力 diff） | 嚴重度判定（CRITICAL/WARNING）、報告格式、**不虛構 finding** 的精確度、嚴重度**邊界**（弱隨機數誘餌不過度升級）、**壓力下守規** |
| `comment` | 4（垃圾＋純保護清單＋壓力清整＋壓力交錯泛化） | 三類垃圾註解的清除、**功能型指令＋why 註解零誤刪**的保護清單、**權威指令下保護清單仍守得住**（c3＝「一行都別留」、c4＝換權威框架＋保護項與垃圾交錯，驗守規非過擬合單一措辭） |

三類場景各司其職：

- **正向**（問題 diff／垃圾檔）：量召回——該抓的有沒有抓、該刪的有沒有刪。
- **反向**（乾淨 diff／已乾淨檔）：量精確度——防過度反應（誤報、誤刪）。
- **壓力**（`review` 的「作者說急著上線都是小問題」／`comment` 的「這檔全是廢話一行都別留」）：量**守規**——時間壓力與權威框架下，嚴重度判定與保護清單是否被帶偏。`review` 場景 1 另埋一個「看似 CRITICAL 實則非安全用途」的 `Math.random` 誘餌，測嚴重度邊界（baseline 易過度升級，skill 應讀出邊界）。

> **待實跑後清理**：discriminating 分類（兩組恆過的斷言要移除）需要實跑資料。首輪跑完依上節四象限法檢視——場景 1 的教科書級安全問題（硬編碼密鑰、SQL 注入）baseline 幾乎必抓，可能落在「兩組恆過」，屆時把量不出增量的斷言換成邊界型斷言。

## 尚未自足評測的 skill（誠實標界）

以下 skill 未建 `evals/`，各有原因，非遺漏：

- **`feat`／`fix`**：編排型 pipeline，跑一次 eval 會展開整條 subagent 鏈，且 fixture 需要一個真實 OpenSpec change＋可跑的專案，無法自足、成本高。後續要測應對一個 sandbox 專案跑，`expectations` 只驗端到端結果（pipeline 完成無錯、產出格式正確），不驗中間步驟。
- **`verify-flow`**：需要一個真的跑起來的瀏覽器 app 當受測目標，無法做成自足 fixture。
- **`decisions`**：**已測，負結果**（`evals-runs.md` Iter 7）。給含 3 個未定分支的需求跑 5 Opus baseline，miss-rate＝0/5——強 baseline 被要求「準備進 propose」時本就會把真正開放的決策 surface 給使用者、能推導的自己推導。與慣例合規同構（baseline 本就做對），不建 evals。屬第 4 個判斷力型 discriminator 負結果。
- **`guidelines`**：純行為守則，由 Coder 載入，宜透過 `feat`／`fix` 的 Coder 產出間接評測，而非獨立跑。
- **`retro`**：append 收件匣、格式固定、drift 風險低，優先度最低。

擴充時沿用相同格式：新增 `skills/<skill>/evals/evals.json`，`skill_name` 對齊 frontmatter，每案 ≥ 3 條可驗證 `expectations`。

## 改判準類條文：先有失敗測試（Iron Law）

改受 evals 覆蓋之 skill 的**判準類條文**（嚴重度定義、保護清單、垃圾三類的邊界等）前，先加一個「現版會 FAIL 的場景或 expectation」，再改條文讓它轉綠。理由（obra superpowers）：沒看過 agent 在無此條文下失敗，就不知道新條文教的是不是對的東西——直接改條文再宣稱改好，等於沒有對照。純措辭調整（不動判準）與外圍流程條文不受此限。
