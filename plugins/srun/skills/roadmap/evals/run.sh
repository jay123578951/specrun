#!/bin/bash
# 判斷點 A（description 路由）的自製 runner：測「該不該載入 srun:roadmap」，不測載入後做得好不好。
# claude plugin eval 被 early access 閘住，故用 claude -p 直跑；--plugin-dir 載工作目錄的 plugin，
# 測得到未 commit 的版本、不必發版。
#
# 設計決策（Iter 8）：
# - **不隔離其他 plugin**。使用者真實環境就是數十個 skill 並存、會競爭路由；隔離後數字好看但高估可靠度。
#   --settings 只關掉已安裝的 srun@specrun，那是避免與 --plugin-dir 這份重複載入，不是隔離。
# - **寫入類開放 Write/Edit**。fixture 是 mktemp 拋棄式副本、每次 run 完即刪，不碰真實檔案；
#   寫入工具被禁時任務走不完，模型會拿 ToolSearch 亂找、燒完 max-turns，量到的軌跡是扭曲的。
#   Bash 一律禁：曾實測模型跑去 ls ~/.claude/，run 不封閉。
#
# 坑一：claude 會讀 stdin，不接 </dev/null 會把 while 迴圈剩下的題目吸走，只跑第一題。
# 坑二：--allowedTools 是預先授權不是白名單，要封閉得靠 --disallowedTools。
# 坑三：全形括號會被 bash 吃進變數名，"$cls）" 要寫成 "${cls}）"。
#
# 用法：./run.sh [runs] [case-id ...]   例：./run.sh 3        ./run.sh 5 A3
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
PLUGIN="$(cd "$HERE/../../.." && pwd)"          # plugins/srun
OUT="${EVAL_OUT:-$HERE/results/$(date +%Y%m%d-%H%M%S)}"
RUNS="${1:-3}"; shift 2>/dev/null || true
FILTER="$*"
mkdir -p "$OUT"

pass=0; fail=0; indet=0
printf '%-6s %-9s %-8s %s\n' CASE 期望 實際 結果
printf '%s\n' "────────────────────────────────────────────"

while IFS=$'\t' read -r id fixture expect cls needs_write prompt; do
  [ -n "$FILTER" ] && ! printf '%s' "$FILTER" | grep -qw "$id" && continue

  if [ "$needs_write" = "true" ]; then
    allow=(Skill Read Glob Grep Write Edit); deny=(Bash); turns=8
  else
    allow=(Skill Read Glob Grep); deny=(Bash Write Edit); turns=6
  fi

  for r in $(seq 1 "$RUNS"); do
    work=$(mktemp -d); cp -R "$HERE/fixtures/$fixture/." "$work/"
    log="$OUT/$id-run$r.jsonl"
    ( cd "$work" && claude -p "$prompt" \
        --plugin-dir "$PLUGIN" \
        --settings '{"enabledPlugins":{"srun@specrun":false}}' \
        --output-format stream-json --verbose \
        --max-turns "$turns" \
        --allowedTools "${allow[@]}" \
        --disallowedTools "${deny[@]}" \
        < /dev/null ) > "$log" 2>"$OUT/$id-run$r.err"
    rm -rf "$work"

    if [ ! -s "$log" ]; then
      actual="indeterminate"
    elif grep -q '"name" *: *"Skill"' "$log" && grep -qE '"skill" *: *"[^"]*roadmap"' "$log"; then
      actual="fire"
    else
      actual="no-fire"
    fi

    if [ "$actual" = "indeterminate" ]; then
      verdict="⚠ INDET"; indet=$((indet+1))
    elif [ "$cls" = "observational" ]; then
      verdict="· 記錄（${cls}）"
    elif [ "$actual" = "$expect" ]; then
      verdict="✔ PASS (${cls})"; pass=$((pass+1))
    else
      verdict="✘ FAIL (${cls})"; fail=$((fail+1))
    fi
    printf '%-6s %-9s %-8s %s\n' "$id#$r" "$expect" "$actual" "$verdict"
  done
done < <(python3 -c '
import json,sys
d=json.load(open(sys.argv[1]))
for c in d["cases"]:
    print("\t".join([c["id"],c["fixture"],c["expect"],c.get("class","value"),
                     "true" if c.get("needs_write") else "false",c["prompt"]]))
' "$HERE/cases.json")

printf '%s\n' "────────────────────────────────────────────"
echo "PASS $pass  FAIL $fail  INDET $indet"
echo "逐次 transcript：$OUT"
[ "$fail" -eq 0 ] || exit 1
