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

- **不追 100% pass rate**：with-skill 全過通常代表題目太簡單（baseline 靠既有能力就能過，量不出增量）——該加難題、往 discriminating 邊界出，而不是慶祝。健康值約 **70%**（Hamel）。
- **跑完按四象限分類 expectation**（skill-creator analyzer）：兩組恆過→移除或替換（虛增分數不帶資訊）；兩組恆敗→斷言壞了/題太難/查錯東西；with 過 baseline 敗→skill 真正加值處，保留；with 敗 baseline 過→skill 可能幫倒忙。
- **同時看成本**：token 與時間也記，delta 買到的品質要對得起花掉的成本。

## 目前覆蓋

優先覆蓋「最容易 drift 且能自足測試」的兩個 skill（稽核報告 P8 指定）：

| Skill | 場景 | 壓測什麼 |
|-------|------|----------|
| `review` | 3（問題 diff＋乾淨 diff＋壓力 diff） | 嚴重度判定（CRITICAL/WARNING）、報告格式、**不虛構 finding** 的精確度、嚴重度**邊界**（弱隨機數誘餌不過度升級）、**壓力下守規** |
| `comment` | 3（垃圾＋純保護清單＋壓力清整） | 三類垃圾註解的清除、**功能型指令＋why 註解零誤刪**的保護清單、**權威指令下保護清單仍守得住** |

三類場景各司其職：

- **正向**（問題 diff／垃圾檔）：量召回——該抓的有沒有抓、該刪的有沒有刪。
- **反向**（乾淨 diff／已乾淨檔）：量精確度——防過度反應（誤報、誤刪）。
- **壓力**（`review` 的「作者說急著上線都是小問題」／`comment` 的「這檔全是廢話一行都別留」）：量**守規**——時間壓力與權威框架下，嚴重度判定與保護清單是否被帶偏。`review` 場景 1 另埋一個「看似 CRITICAL 實則非安全用途」的 `Math.random` 誘餌，測嚴重度邊界（baseline 易過度升級，skill 應讀出邊界）。

> **待實跑後清理**：discriminating 分類（兩組恆過的斷言要移除）需要實跑資料。首輪跑完依上節四象限法檢視——場景 1 的教科書級安全問題（硬編碼密鑰、SQL 注入）baseline 幾乎必抓，可能落在「兩組恆過」，屆時把量不出增量的斷言換成邊界型斷言。

## 尚未自足評測的 skill（誠實標界）

以下 skill 未建 `evals/`，各有原因，非遺漏：

- **`feat`／`fix`**：編排型 pipeline，跑一次 eval 會展開整條 subagent 鏈，且 fixture 需要一個真實 OpenSpec change＋可跑的專案，無法自足、成本高。後續要測應對一個 sandbox 專案跑，`expectations` 只驗端到端結果（pipeline 完成無錯、產出格式正確），不驗中間步驟。
- **`verify-flow`**：需要一個真的跑起來的瀏覽器 app 當受測目標，無法做成自足 fixture。
- **`decisions`**：可測（給一段含已知未定分支的需求，驗它找出分支且不硬湊），但 fixture 需模擬 explore 結論＋ codebase context——下一個優先候選。
- **`guidelines`**：純行為守則，由 Coder 載入，宜透過 `feat`／`fix` 的 Coder 產出間接評測，而非獨立跑。
- **`retro`**：append 收件匣、格式固定、drift 風險低，優先度最低。

擴充時沿用相同格式：新增 `skills/<skill>/evals/evals.json`，`skill_name` 對齊 frontmatter，每案 ≥ 3 條可驗證 `expectations`。

## 改判準類條文：先有失敗測試（Iron Law）

改受 evals 覆蓋之 skill 的**判準類條文**（嚴重度定義、保護清單、垃圾三類的邊界等）前，先加一個「現版會 FAIL 的場景或 expectation」，再改條文讓它轉綠。理由（obra superpowers）：沒看過 agent 在無此條文下失敗，就不知道新條文教的是不是對的東西——直接改條文再宣稱改好，等於沒有對照。純措辭調整（不動判準）與外圍流程條文不受此限。
