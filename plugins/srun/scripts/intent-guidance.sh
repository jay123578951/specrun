#!/bin/bash
# 入口意圖引導層：SessionStart 注入腳本（matcher 不設 = startup/resume/clear/compact 四開，
# compact 後重灌規則以緩解長 session 衰減）。
# 注入文本是 runtime SSOT；規格與適配表對照見 plugin docs/intent-guidance-adapter.md。
# 偵測是確定性腳本判斷——模型只收到已解析後端的交界圖，不自判後端。

dir="${CLAUDE_PROJECT_DIR:-$PWD}"

# 偵測順序：SPECTRA 標記優先（spectra 專案同樣帶 openspec/ 目錄，反序會誤判）
backend="none"
if grep -qs "SPECTRA:START" "$dir/CLAUDE.md"; then
  backend="spectra"
elif [ -d "$dir/openspec" ]; then
  backend="openspec"
fi

cat << 'RULES'
## 意圖引導（specrun 入口層）

使用者在多種模式間切換：討論、診斷、實作。只在「動手邊界」做一次判斷——使用者訊息首次浮現開發／修改意圖時，或你即將第一次改檔案時；其他時候不分類、不問。

1. 意圖清楚 → 一句話宣告判讀後照做，不徵求同意。例：「聽起來要先找出原因，我唯讀調查、不動 code。」
2. 意圖模糊、或站在流程入口 → 用 AskUserQuestion 跳選項：選項說意圖、不說指令名；使用者選定後，宣告實際指令再執行。
3. 診斷結論是交付物：查完回報根因就停，修復是新意圖、需明確授權。「偏向做 X」「幫我看一下」是方向表態、「幫我處理一下」是模糊委託——都不是動工授權；不確定就問「要開始了嗎，還是繼續討論？」
4. 診斷中可加臨時 debug log 驗證假設（宣告一句、回報前清除；所在流程唯讀就宣告暫出——暫出仍是診斷，根因查明照樣到停點）；修改邏輯即屬修復。
5. 頻率紀律：一個交界最多問一次；使用者略過選項就照字面做，不糾纏；單行修改、純樣式微調永不觸發。使用者直接手打指令＝意圖已明示，直接執行不問。
6. 純討論走不到動手邊界——全程靜默，不推銷流程。
RULES

case "$backend" in
  spectra)
    cat << 'MAP'

本專案交界圖（後端：spectra；「跳選項」= AskUserQuestion，依情境把建議項排第一並標「建議」）：
- 入口·開發意圖浮現 → 跳選項：走規格流程（/spectra-discuss）｜直接動手（對話直改）｜先診斷（/spectra-discuss；一次性小疑問宣告裸查即可）｜繼續討論
- discuss 完 → 跳選項：先收斂設計決策（/srun:decisions；功能複雜或分支多時建議）｜直接產出規格（/spectra-propose）｜再討論一下
- decisions 完 → 宣告一句，跑 /spectra-propose
- propose 完 → 確認使用者已人工審過 spec，再跑 /srun:feat
- feat 完 → 把 spec 驗收點攤成清單，交人工驗收
- 驗收發現問題、或診斷根因確認 → 跳選項：規格層問題（/spectra-ingest）｜實作層小問題（/srun:fix）｜瑣碎（對話直改）
- 驗收通過 → 宣告，跑 /spectra-archive；archive 完順帶提一句 /srun:retro
- pipeline／skill 流程內部 → 靜默，流程自身紀律優先
MAP
    ;;
  openspec)
    cat << 'MAP'

本專案交界圖（後端：openspec CLI；「跳選項」= AskUserQuestion，依情境把建議項排第一並標「建議」）：
- 入口·開發意圖浮現 → 跳選項：走規格流程（/opsx:explore）｜直接動手（對話直改）｜先診斷（宣告唯讀調查）｜繼續討論
- explore 完 → 跳選項：先收斂設計決策（/srun:decisions；功能複雜或分支多時建議）｜直接產出規格（/opsx:propose）｜再討論一下
- decisions 完 → 宣告一句，跑 /opsx:propose
- propose 完 → 確認使用者已人工審過 proposal，再跑 /srun:feat
- feat 完 → 把 spec 驗收點攤成清單，交人工驗收
- 驗收發現問題、或診斷根因確認 → 跳選項：規格層問題（先更新 spec 再處理）｜實作層小問題（/srun:fix）｜瑣碎（對話直改）
- 驗收通過 → 打包宣告一次，依序 /opsx:verify → /opsx:sync → /opsx:archive；archive 完順帶提一句 /srun:retro
- pipeline／skill 流程內部 → 靜默，流程自身紀律優先
MAP
    ;;
  none)
    cat << 'MAP'

本專案未偵測到規格後端（無 SPECTRA 標記、無 openspec/），入口降級：
- 入口·開發意圖浮現 → 跳選項：初始化規格流程（先問使用者偏好的工具再協助設置）｜直接動手（對話直改）｜先診斷（宣告唯讀調查）｜繼續討論
- 診斷根因確認 → 回報後停，問要不要修；修法在對話收斂即可
MAP
    ;;
esac

exit 0
