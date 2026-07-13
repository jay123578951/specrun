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
| 進規格討論流程（入口，宣告制預設） | `/spectra-discuss`［`<change 名>`］ | `/opsx:explore`（吻合的 change 名寫進話題） | 跳降級選項（先問偏好工具、協助初始化） |
| change 掃描（進場前置，一個指令） | `spectra list` | `ls openspec/changes/` | — |
| 先診斷（入口） | 宣告唯讀調查 | 宣告唯讀調查 | 宣告唯讀調查 |
| 先收斂設計決策（交界 1，岔路） | `/srun:decisions` | `/srun:decisions` | — |
| 直接產出規格（交界 1） | `/spectra-propose` | `/opsx:propose` | — |
| 實作（交界 3，前置：人工審過 spec） | `/srun:feat` | `/srun:feat` | — |
| 規格層問題（交界 4b，岔路） | `/spectra-ingest` | 先更新 spec 再處理 | — |
| 實作層小問題（交界 4b） | `/srun:fix` | `/srun:fix` | — |
| 收尾（驗收通過） | `/spectra-archive`（一步） | `/opsx:verify` → `/opsx:sync` → `/opsx:archive`（打包宣告一次） | — |
| 回顧（archive 完，順帶一句） | `/srun:retro` | `/srun:retro` | — |

分級支援：spectra 行為主線一級公民（考卷與 dogfood 全覆蓋）；openspec 行 best-effort（措辭保證正確、不主動驗證）。`spectra-debug`／`spectra-apply` 原則性不進選項（前者繞過診斷停點、後者被 `/srun:feat` 取代），escape hatch 手動可用。

## 行為紀律（與注入規則同源）

- **入口宣告制**（0.19.0，收件匣三案對照實驗驅動）：開發／修改意圖（含求建議、求評估的開發話題）預設宣告一句進規格討論流程，不跳選項、不徵求同意；宣告尾帶「要我直接動手就說一聲」當 escape hatch。依據：discuss 唯讀、誤入成本近零，誤直改不可逆——錯誤成本不對稱，預設倒向 fail-safe 側。
- **直改豁免是三錨白名單**（符合才豁免，非「AI 覺得單純」就豁免）：①祈使句式 ②標的明確到檔案／元件 ③不刪不換既有結構。任一缺就進流程。
- **change 掃描在引導層，不在規格後端**（SPECTRA／openspec 均為外部凍結件）：進場前一個 list 指令；零個＝新題目、唯一吻合＝帶名進場（借力 spectra-discuss 既有的帶 name 載入條件句）、多個或不確定＝跳選項一次。吻合判斷只到 change 名層級，入口保持輕；「追加既有 change vs 開新 change」是 discuss 的產出、不在進場時拍板。
- AskUserQuestion 降為兜底：只服務「連開發還是討論都判不出」的真模糊、多 change 歸屬、與流程中段既有岔路（交界 1、4b）。
- **機考回饋兩補**（0.19.0 機考後）：①宣告後即執行流程指令，不就地代辦 discuss／decisions 的內容（五題未過的共同病灶＝流程代辦）；②討論進行中的方案表態不重新觸發入口——進不進流程在意圖首次浮現時已判過，中段只確認要不要開始（規則 2/5 對「偏向 X」句式的優先級裁決）。
- 岔路跳選項、直路只宣告、pipeline／skill 流程內部靜默。
- 選項只放主線（paved road）：AskUserQuestion 至多四格，偶用件不進選項。
- 選項標籤說意圖不說指令名；選定後宣告實際指令再執行（透明＋可畢業）。
- matcher 不設限＝ startup／resume／clear／compact 四開；compact 重灌緩解長 session 衰減。
- SessionStart 對 subagent 不生效（實測），pipeline subagent 不會讀到本規則。
