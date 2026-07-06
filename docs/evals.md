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

skill-creator **不含自動執行器**，是人-AI 協作流程（會消耗 API、由你手動觸發）：

1. 安裝官方工具：`/plugin install skill-creator@claude-plugins-official`
2. 同一 turn 內並行派兩個 subagent 跑同一個 `prompt`：一個載入受測 skill（with-skill）、一個不載入（baseline），輸出各自存檔。
3. 依 skill-creator 的 `agents/grader.md` 指引派 grader，對照 `expectations` 逐項判定，產出 `grading.json`。
4. `python -m scripts.aggregate_benchmark <iteration-dir> --skill-name <skill>` 聚合（可各跑多次取平均）。
5. `eval-viewer/generate_review.py` 開查看器人工評閱，反饋後改 skill、重跑下一 iteration 比較。

判讀重點：**with-skill 的 pass_rate 明顯高於 baseline** 才證明 skill 有效；兩者相近代表 skill 沒帶來增益或觸發關鍵字失效。

## 目前覆蓋

優先覆蓋「最容易 drift 且能自足測試」的兩個 skill（稽核報告 P8 指定）：

| Skill | 場景 | 壓測什麼 |
|-------|------|----------|
| `review` | 2（含問題 diff＋乾淨 diff） | 嚴重度判定（CRITICAL/WARNING）、報告格式、**不虛構 finding** 的精確度 |
| `comment` | 2（含垃圾＋純保護清單） | 三類垃圾註解的清除、**功能型指令＋why 註解零誤刪**的保護清單 |

兩者各含一個「反向」場景（乾淨 diff／已乾淨檔），量測精確度而非只量召回——防 skill 過度反應（誤報、誤刪）。

## 尚未自足評測的 skill（誠實標界）

以下 skill 未建 `evals/`，各有原因，非遺漏：

- **`feat`／`fix`**：編排型 pipeline，跑一次 eval 會展開整條 subagent 鏈，且 fixture 需要一個真實 OpenSpec change＋可跑的專案，無法自足、成本高。後續要測應對一個 sandbox 專案跑，`expectations` 只驗端到端結果（pipeline 完成無錯、產出格式正確），不驗中間步驟。
- **`verify-flow`**：需要一個真的跑起來的瀏覽器 app 當受測目標，無法做成自足 fixture。
- **`decisions`**：可測（給一段含已知未定分支的需求，驗它找出分支且不硬湊），但 fixture 需模擬 explore 結論＋ codebase context——下一個優先候選。
- **`guidelines`**：純行為守則，由 Coder 載入，宜透過 `feat`／`fix` 的 Coder 產出間接評測，而非獨立跑。
- **`retro`**：append 收件匣、格式固定、drift 風險低，優先度最低。

擴充時沿用相同格式：新增 `skills/<skill>/evals/evals.json`，`skill_name` 對齊 frontmatter，每案 ≥ 3 條可驗證 `expectations`。
