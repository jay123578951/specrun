#!/usr/bin/env node
// feat／fix 的改動清單：以 Git 算出這次 run 實際改了哪些檔，下游拿這份，不拿 agent 自己報的清單。
// 用法：
//   node change-list.mjs start <起點檔> [--new]
//     記下起點：當下的 commit、當下已經有未 commit 改動的檔和它們的內容雜湊，
//     以及被 gitignore 的敏感檔（.env、私鑰）的內容雜湊。
//     起點檔已存在就沿用，中斷接手時起點才不會被蓋掉；--new 一律重記。
//   node change-list.mjs list <起點檔> [--reported <路徑>...]
//     列出起點之後改動的檔，一行一檔：「新增|修改|刪除|Coder 回報<TAB>路徑」，路徑相對 repo 根目錄。
//     - 開工前就有的改動，內容沒再變就不列
//     - 被 gitignore 的敏感檔，內容和起點不同就列
//     - --reported 接 agent 回報改過的檔（相對 repo 根目錄或絕對路徑）：Git 看得到的檔以 Git 為準，
//       被 gitignore、Git 看不到的才採信，標「Coder 回報」
//     - openspec/、.claude/debug/、.playwright-mcp/ 不列：規格由流程另外處理，另外兩個是流程自己的暫存
//     起點 commit 不在目前分支的歷史上（切過分支、改寫過歷史）時，清單算不準，印出原因並以結束碼 2 結束。
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'

const [cmd, file, ...rest] = process.argv.slice(2)
if (!['start', 'list'].includes(cmd) || !file) {
  console.error('用法：change-list.mjs start <起點檔> [--new]｜change-list.mjs list <起點檔> [--reported <路徑>...]')
  process.exit(1)
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const root = git('rev-parse', '--show-toplevel').trim()
const gitAt = (...args) => git('-C', root, ...args)
const split0 = s => s.split('\0').filter(Boolean)
const EXCLUDED = ['openspec/', '.claude/debug/', '.playwright-mcp/']
const excluded = p => EXCLUDED.some(dir => p.startsWith(dir))
const SENSITIVE = ['.env', '.env.*', '*.pem', '*.key', 'id_rsa*'].map(p => `:(glob)**/${p}`)

function hashOf(path) {
  try {
    return createHash('sha1').update(readFileSync(join(root, path))).digest('hex')
  }
  catch {
    return null
  }
}

const untracked = () => split0(gitAt('ls-files', '--others', '--exclude-standard', '-z'))
const ignoredSensitive = () => split0(gitAt('ls-files', '--others', '--ignored', '--exclude-standard', '-z', '--', ...SENSITIVE))
const hashes = paths => Object.fromEntries(paths.map(p => [p, hashOf(p)]))
const snapshotPath = resolve(file)

if (cmd === 'start') {
  if (existsSync(snapshotPath) && !rest.includes('--new')) {
    console.log(`沿用既有起點：${snapshotPath}`)
    process.exit(0)
  }
  const commit = gitAt('rev-parse', 'HEAD').trim()
  const before = hashes([...split0(gitAt('diff', '--name-only', '-z', 'HEAD')), ...untracked()])
  const sensitive = hashes(ignoredSensitive())
  mkdirSync(dirname(snapshotPath), { recursive: true })
  writeFileSync(snapshotPath, `${JSON.stringify({ commit, before, sensitive }, null, 2)}\n`)
  console.log(`已記下起點：commit ${commit.slice(0, 7)}，開工前已有改動的檔 ${Object.keys(before).length} 個，被 gitignore 的敏感檔 ${Object.keys(sensitive).length} 個`)
  process.exit(0)
}

const { commit, before, sensitive = {} } = JSON.parse(readFileSync(snapshotPath, 'utf8'))
try {
  gitAt('merge-base', '--is-ancestor', commit, 'HEAD')
}
catch {
  console.error(`起點 commit ${commit.slice(0, 7)} 不在目前分支的歷史上（切過分支或改寫過歷史），改動清單算不準`)
  process.exit(2)
}

const label = { A: '新增', D: '刪除' }
const changed = new Map()
const fields = split0(gitAt('diff', '--name-status', '--no-renames', '-z', commit))
for (let i = 0; i + 1 < fields.length; i += 2)
  changed.set(fields[i + 1], label[fields[i][0]] ?? '修改')
for (const p of untracked())
  changed.set(p, '新增')
// 開工前就有改動、這次又被改回起點 commit 版本的檔，不在 diff 裡，但這次確實動過
for (const p of Object.keys(before)) {
  if (!changed.has(p) && hashOf(p) !== before[p])
    changed.set(p, '修改')
}
for (const p of changed.keys()) {
  if (p in before && hashOf(p) === before[p])
    changed.delete(p)
}

for (const p of new Set([...Object.keys(sensitive), ...ignoredSensitive()])) {
  const now = hashOf(p)
  if (now === (sensitive[p] ?? null))
    continue
  changed.set(p, now === null ? '刪除' : p in sensitive ? '修改' : '新增')
}

const reportedAt = rest.indexOf('--reported')
const reported = reportedAt === -1 ? [] : rest.slice(reportedAt + 1)
for (const raw of reported) {
  const p = relative(root, isAbsolute(raw) ? raw : resolve(root, raw)).split('\\').join('/')
  if (p.startsWith('..') || changed.has(p))
    continue
  try {
    gitAt('check-ignore', '-q', '--', p)
    changed.set(p, 'Coder 回報')
  }
  catch {
    // 沒被 gitignore：Git 看得到這個檔，Git 說沒改就是沒改
  }
}

const lines = [...changed]
  .filter(([p]) => !excluded(p))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([p, s]) => `${s}\t${p}`)
if (lines.length)
  console.log(lines.join('\n'))
