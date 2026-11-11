#!/bin/bash
# git 攔截（PreToolUse，matcher: Bash）：拒絕會洗掉工作樹改動的 git 指令。
# - subagent：一律攔。Claude Code 只在 subagent 內的工具呼叫帶非空的 agent_id
# - 主對話：feat／fix 正在跑時才攔，以 .claude/debug/ 有改動清單的起點檔為準；其他時候放行
# 拒絕只回訊息給下指令的那一方，流程不會停下來等人。

input=$(cat)

reason='這個 git 指令會丟掉工作樹上還沒 commit 的改動，包括其他 agent 的。要還原時，只改回自己動過的那幾行；要看舊版時，用 git diff、git show 讀。'
if ! printf '%s' "$input" | grep -qE '"agent_id"[[:space:]]*:[[:space:]]*"[^"]'; then
  root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
  compgen -G "$root/.claude/debug/*起點.json" >/dev/null || exit 0
  reason='feat／fix 正在跑（.claude/debug/ 有改動清單的起點檔），這個 git 指令會丟掉工作樹上還沒 commit 的改動。要看開工前的版本，用 git worktree 另開臨時目錄跑，跑完刪掉；要讀舊版內容，用 git diff、git show。'
fi

cmd=$(printf '%s' "$input" \
  | grep -oE '"command"[[:space:]]*:[[:space:]]*"([^"\\]|\\.)*"' \
  | head -1 \
  | sed -E 's/^"command"[[:space:]]*:[[:space:]]*"//; s/"$//')

case "$cmd" in
  *git*) ;;
  *) exit 0 ;;
esac

cmd=${cmd//\\\\/$'\002'}
cmd=${cmd//\\n/$'\n'}
cmd=${cmd//\\t/$'\t'}
cmd=${cmd//\\\"/\"}
cmd=${cmd//$'\002'/\\}

# 只看實際執行的指令：拿掉 heredoc 內文與引號內的文字，commit 訊息提到 git stash 才不會誤攔
strip_text() {
  printf '%s\n' "$1" \
    | awk '
        mark != "" { line = $0; sub(/^\t+/, "", line); if (line == mark) mark = ""; next }
        {
          print
          text = $0
          gsub(/<<</, "", text)
          if (match(text, /<<-?[ \t]*['\''"\\]?[A-Za-z_][A-Za-z0-9_]*/)) {
            mark = substr(text, RSTART, RLENGTH)
            sub(/^<<-?[ \t]*['\''"\\]?/, "", mark)
          }
        }' \
    | tr '\n' '\001' \
    | sed -E "s/\"([^\"\\\\]|\\\\.)*\"|'[^']*'/Q/g"
}

discards_changes() {
  while [ $# -gt 0 ]; do
    case "$1" in
      -C|-c|--git-dir|--work-tree|--namespace)
        [ $# -ge 2 ] || return 1
        shift 2
        ;;
      -*) shift ;;
      *) break ;;
    esac
  done
  [ $# -gt 0 ] || return 1
  sub=$1
  shift

  case "$sub" in
    stash)
      case "${1:-}" in
        list|show) return 1 ;;
      esac
      return 0
      ;;
    restore)
      staged=0
      worktree=0
      for arg in "$@"; do
        case "$arg" in
          --staged|-S) staged=1 ;;
          --worktree|-W) worktree=1 ;;
          -SW|-WS) staged=1; worktree=1 ;;
        esac
      done
      [ "$staged" = 1 ] && [ "$worktree" = 0 ] && return 1
      return 0
      ;;
    checkout)
      count=0
      target=
      for arg in "$@"; do
        case "$arg" in
          -b|-B|--orphan) return 1 ;;
          -f|--force|--) return 0 ;;
          -*) ;;
          *) count=$((count + 1)); target=$arg ;;
        esac
      done
      [ "$count" -ge 2 ] && return 0
      if [ "$count" = 1 ] && [ -e "$target" ] \
        && ! git rev-parse --verify --quiet "$target^{commit}" >/dev/null 2>&1; then
        return 0
      fi
      return 1
      ;;
    switch)
      for arg in "$@"; do
        case "$arg" in
          -f|--force|--discard-changes) return 0 ;;
        esac
      done
      return 1
      ;;
    reset)
      for arg in "$@"; do
        [ "$arg" = --hard ] && return 0
      done
      return 1
      ;;
    clean)
      force=0
      for arg in "$@"; do
        case "$arg" in
          --dry-run) return 1 ;;
          --force) force=1 ;;
          --*) ;;
          -*n*) return 1 ;;
          -*f*) force=1 ;;
        esac
      done
      [ "$force" = 1 ]
      return
      ;;
  esac
  return 1
}

set -f
while IFS= read -r segment; do
  # shellcheck disable=SC2086
  set -- $segment
  while [ $# -gt 0 ]; do
    case "$1" in
      [A-Za-z_]*=*) shift ;;
      *) break ;;
    esac
  done
  case "${1:-}" in
    git|*/git)
      shift
      if discards_changes "$@"; then
        printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$reason"
        exit 0
      fi
      ;;
  esac
done < <(strip_text "$cmd" | tr '\001;|&(){}' '\n')

exit 0
