# 入口意圖引導層：後端適配表

> **runtime SSOT 是 `scripts/intent-guidance.sh` 的注入文本**——本檔是維護用對照表，改措辭時：①改 script ②同步本表 ③拿入口考卷掃一遍，全對才放行。考卷與設計決策 doc 由維護者本機保管，不隨 repo 發佈。

## 偵測（確定性，SessionStart hook 腳本內判斷，模型不自判後端）

| 順序 | 訊號 | 後端 |
|------|------|------|
| 1 | 專案 CLAUDE.md 含 `SPECTRA:START` 標記 | spectra |
| 2 | 專案根目錄有 `openspec/` | openspec CLI |
| 3 | 皆無 | none（入口降級） |

順序不可對調：spectra 專案的資料格式與 OpenSpec 相容、同樣帶 `openspec/` 目錄。

## 適配表（措辭單版本，說意圖；最後一步查表翻指令）

| 意圖（交界） | spectra | openspec CLI | none |
|--------------|---------|--------------|------|
| 走規格流程（入口） | `/spectra-discuss` | `/opsx:explore` | 先問偏好工具、協助初始化 |
| 先診斷（入口） | `/spectra-discuss`（小疑問裸查） | 宣告唯讀調查 | 宣告唯讀調查 |
| 先收斂設計決策（交界 1，岔路） | `/srun:decisions` | `/srun:decisions` | — |
| 直接產出規格（交界 1） | `/spectra-propose` | `/opsx:propose` | — |
| 實作（交界 3，前置：人工審過 spec） | `/srun:feat` | `/srun:feat` | — |
| 規格層問題（交界 4b，岔路） | `/spectra-ingest` | 先更新 spec 再處理 | — |
| 實作層小問題（交界 4b） | `/srun:fix` | `/srun:fix` | — |
| 收尾（驗收通過） | `/spectra-archive`（一步） | `/opsx:verify` → `/opsx:sync` → `/opsx:archive`（打包宣告一次） | — |
| 回顧（archive 完，順帶一句） | `/srun:retro` | `/srun:retro` | — |

分級支援：spectra 行為主線一級公民（考卷與 dogfood 全覆蓋）；openspec 行 best-effort（措辭保證正確、不主動驗證）。`spectra-debug`／`spectra-apply` 原則性不進選項（前者繞過診斷停點、後者被 `/srun:feat` 取代），escape hatch 手動可用。

## 行為紀律（與注入規則同源）

- 岔路跳選項、直路只宣告、pipeline／skill 流程內部靜默。
- 選項只放主線（paved road）：AskUserQuestion 至多四格，偶用件不進選項。
- 選項標籤說意圖不說指令名；選定後宣告實際指令再執行（透明＋可畢業）。
- matcher 不設限＝ startup／resume／clear／compact 四開；compact 重灌緩解長 session 衰減。
- SessionStart 對 subagent 不生效（實測），pipeline subagent 不會讀到本規則。
