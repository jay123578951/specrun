#!/usr/bin/env node
// git-guard.sh 的刪除檢查：feat／fix 進行中，subagent 要刪的東西裡有 Git 救不回來、又不是這次 run 建的內容時，印出第一個這樣的路徑。
// 用法：node delete-guard.mjs <repo 根目錄> <指令的工作目錄> <要刪的路徑>...
// 擋：被 gitignore 的檔案（含 .claude/debug/ 的流程檔、.env）；開工前就存在的未追蹤檔案或未 commit 改動（起點檔的 before）
// 放行：這次 run 新建、沒被 gitignore 的檔案；已 commit 沒改過的檔案；repo 外的路徑；不存在的路徑
// 只看得到指令裡寫死的路徑；引號內的路徑、變數、程式裡的刪除都看不到。
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'

const [root, wd, ...targets] = process.argv.slice(2)
const debugDir = join(root, '.claude', 'debug')

const before = new Set()
for (const name of existsSync(debugDir) ? readdirSync(debugDir) : []) {
  if (!name.endsWith('起點.json'))
    continue
  try {
    Object.keys(JSON.parse(readFileSync(join(debugDir, name), 'utf8')).before ?? {}).forEach(p => before.add(p))
  }
  catch {}
}

for (const raw of targets) {
  if (raw === 'Q')
    continue
  // 萬用字元由 shell 在執行時展開，這裡看不到展開結果，改查它所在的資料夾
  let abs = resolve(isAbsolute(raw) ? raw : join(wd, raw))
  while (/[*?[]/.test(abs))
    abs = dirname(abs)
  if (!existsSync(abs))
    continue
  const rel = relative(root, abs)
  if (rel.startsWith('..') || isAbsolute(rel))
    continue
  let out
  try {
    out = execFileSync('git', ['-C', root, 'status', '--porcelain=v1', '-z', '--no-renames', '--ignored', '--untracked-files=all', '--', `:(literal)${rel || '.'}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  }
  catch {
    continue
  }
  for (const entry of out.split('\0').filter(Boolean)) {
    const code = entry.slice(0, 2)
    const path = entry.slice(3)
    if (code === '!!') {
      console.log(`${path}（被 gitignore，Git 救不回來）`)
      process.exit(0)
    }
    if (before.has(path.replace(/\/$/, ''))) {
      console.log(`${path}（開工前就在，Git 救不回來）`)
      process.exit(0)
    }
  }
}
