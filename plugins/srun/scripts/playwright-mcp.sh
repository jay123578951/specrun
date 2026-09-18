#!/usr/bin/env bash
# 啟動 srun 隨附的 playwright MCP server。
# 不經 npx：npx 每次啟動都要先問一次 npm registry（釘版本、已快取都一樣），
# registry 那一刻沒回應就掛住超過 Claude Code 的 30 秒握手，MCP 整台逾時。
# 這裡改成第一次把套件裝進 plugin 的資料目錄（唯一一次上網），之後直接用 node 起，零網路。
# 瀏覽器走系統 Chrome：@playwright/mcp 每一版都依賴 playwright 的 alpha 版，
# 每次換版就要求一顆本機沒有的 chromium；系統 Chrome 不受這個綁定。
set -euo pipefail

VERSION="0.0.81"
DATA_DIR="${SRUN_PLAYWRIGHT_MCP_DATA:-}"
if [ -z "$DATA_DIR" ] || [[ "$DATA_DIR" == *'${'* ]]; then
  DATA_DIR="${HOME}/.cache/srun-playwright-mcp"
fi
PKG_DIR="${DATA_DIR}/playwright-mcp"
CLI="${PKG_DIR}/node_modules/@playwright/mcp/cli.js"
PKG_JSON="${PKG_DIR}/node_modules/@playwright/mcp/package.json"

log() { printf '[srun playwright-mcp] %s\n' "$*" >&2; }

installed_version() {
  [ -f "$PKG_JSON" ] || return 1
  node -e 'process.stdout.write(require(process.argv[1]).version)' "$PKG_JSON" 2>/dev/null
}

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  log "找不到 node 或 npm，無法啟動；請確認 PATH"
  exit 1
fi

current="$(installed_version || true)"
if [ "$current" != "$VERSION" ]; then
  log "安裝 @playwright/mcp@${VERSION} 到 ${PKG_DIR}（只有這一次會上網）"
  mkdir -p "$PKG_DIR"
  # stdout 是 MCP 的 JSON-RPC 通道，安裝輸出一律導到 stderr
  if ! npm install --prefix "$PKG_DIR" --no-audit --no-fund --no-package-lock --loglevel=error "@playwright/mcp@${VERSION}" >&2; then
    log "安裝失敗；請檢查網路後重開 session，或手動執行：npm install --prefix ${PKG_DIR} @playwright/mcp@${VERSION}"
    exit 1
  fi
fi

exec node "$CLI" --browser chrome "$@"
