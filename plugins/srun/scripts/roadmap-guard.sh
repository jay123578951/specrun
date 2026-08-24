#!/bin/bash
# roadmap 機械提醒層（PostToolUse，matcher: Bash|Skill）：
# - propose skill 載入後提醒遷出＋填名（此刻 skill 指令剛進 context、尚未寫檔，等同事前備料；
#   PreToolUse 不支援 additionalContext，故一律走 PostToolUse）
# - archive 指令執行後抽 change 名 grep roadmap：命中指名檔案、未命中一行短提醒
# - spectra new 保險：propose 流程外手動建 change 時提醒填名
# - rm roadmap 檔攔截：三層分組出口鏈保底，提醒回上層檔打勾
# 純 stdout 不進模型 context，提醒一律輸出 hookSpecificOutput.additionalContext JSON。
# 無 openspec/roadmap/ 一律靜默：目錄即開關，roadmap.off 不需檢查。
# 比對只取 tool_input 的欄位值，不掃整包 hook 輸入：tool_response 含指令輸出，
# 讀到提及 archive 的檔案內容會誤觸。

dir="${CLAUDE_PROJECT_DIR:-$PWD}"
[ -d "$dir/openspec/roadmap" ] || exit 0

input=$(cat)

emit() {
  esc=$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n' ' ')
  printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"%s"}}\n' "$esc"
}

# 取 JSON 第一個 "<key>": "<字串>" 的值並解逸出。tool_input 排在 tool_response 之前，
# 故 head -1 取到的是真正的輸入欄位。
json_str() {
  pat='"KEY"[[:space:]]*:[[:space:]]*"([^"\\]|\\.)*"'
  pat=${pat/KEY/$1}
  printf '%s' "$input" \
    | grep -oE "$pat" \
    | head -1 \
    | sed -E "s/^\"$1\"[[:space:]]*:[[:space:]]*\"//; s/\"\$//" \
    | sed 's/\\n/ /g; s/\\t/ /g; s/\\"/"/g; s/\\\\/\\/g'
}

tool=$(printf '%s' "$input" | grep -oE '"tool_name"[[:space:]]*:[[:space:]]*"[A-Za-z]+"' | head -1 | sed 's/.*"\([A-Za-z]*\)"$/\1/')

case "$tool" in
  Skill)
    case "$(json_str skill)" in
      spectra-propose|opsx:propose)
        emit "roadmap 提醒：本題若屬某 roadmap 開發項，propose 時把該段「動工前必知」整組遷入 design.md 並自 roadmap 刪除，change 名填進拆分表該列（操作見 srun:roadmap skill）；不屬任何開發項則忽略本提醒。"
        ;;
    esac
    ;;
  Bash)
    cmd=$(json_str command)
    if printf '%s' "$cmd" | grep -qE '(spectra|openspec)[[:space:]]+archive([[:space:]]|$)'; then
      name=$(printf '%s' "$cmd" | grep -oE '(spectra|openspec)[[:space:]]+archive[[:space:]]+[A-Za-z0-9._/-]+' | head -1 | awk '{print $3}')
      if [ -z "$name" ]; then
        # 互動式歸檔，命令列沒有 change 名可比對
        emit "roadmap 提醒：剛執行歸檔。此 change 若屬某 roadmap 開發項，回該檔拆分表打勾並更新標題行狀態；全交付則確認全勾、向使用者說一聲再 rm 整檔（操作見 srun:roadmap skill）。"
      else
        files=$(cd "$dir" && grep -rlF -- "$name" openspec/roadmap 2>/dev/null | paste -sd '、' -)
        if [ -n "$files" ]; then
          emit "roadmap 提醒：change「${name}」見於 ${files}。打勾該列並更新標題行狀態；該開發項全交付則確認拆分表全勾、向使用者說一聲再 rm 整檔（操作見 srun:roadmap skill）。"
        else
          emit "roadmap 提醒：此 change 未見於 openspec/roadmap/；若屬某開發項，補上該列再更新。"
        fi
      fi
    elif printf '%s' "$cmd" | grep -qE 'spectra[[:space:]]+new[[:space:]]'; then
      emit "roadmap 提醒：新 change 若屬某 roadmap 開發項，把 change 名填進拆分表該列，並把該段「動工前必知」遷入 design.md、自 roadmap 刪除（操作見 srun:roadmap skill）。"
    elif printf '%s' "$cmd" | grep -qE '(^|[^[:alnum:]_.-])rm[[:space:]].*openspec/roadmap/'; then
      emit "roadmap 提醒：剛移除 roadmap 檔。該檔若有「屬於」欄位，回上層檔拆分表打勾並更新標題行 N/M；上層全勾則確認後一併 rm（操作見 srun:roadmap skill）。"
    fi
    ;;
esac

exit 0
