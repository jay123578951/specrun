#!/usr/bin/env node
// 驗收頁：把 tasks 的驗收項目、每一項驗完了沒、截圖排成一頁本機 HTML，給人驗收時看。
// 項目原文由本腳本從 tasks.md 讀，不收 agent 的轉述；缺證據時不產生頁面。
// 用法：
//   node evidence-page.mjs shot <資料夾> [--items 4.1,4.2] [--role '<身分>']
//        --shot '<圖檔>' --path '<路徑>' --state '<狀態>' [--shot '<圖檔>' --path '…' --state '…']...
//     記一筆截圖證據，可以一次交好幾張，每張各帶自己的路徑與狀態。
//     --path   截圖當下的網址，人要靠它回到同一頁；給完整網址會自動只留網域後面那段
//     --state  一句話：這張是在什麼狀態下拍的（同一頁拍兩張時靠它分辨）
//     --role   截圖時登入的身分；不分身分的專案省略
//     圖檔要已經存在 <資料夾> 裡。一張圖能說明好幾項就把編號都列上；
//     沒有對應的驗收項目時省略 --items，頁面會列在「改到的畫面」。
//   node evidence-page.mjs cmd <資料夾> --items 4.4 --cmd "<指令>" --result "<結果那一行>"
//     記一筆指令證據：實際跑的指令和它的結果。有這一筆，那一項才算已驗完；指令與結果只留在紀錄檔，不印在頁面上。
//   node evidence-page.mjs env <資料夾> --url '<驗證時 app 的網址>'
//     記這次驗證時 app 的網址。頁面列在最上面，連同截圖時登入過的身分，人要複測時照著用。
//   node evidence-page.mjs human <資料夾> --items 4.6 --check '<要人驗什麼>' --why '<為什麼自動檢查接不住>'
//     記一筆要人親手驗的事，頁面會印在那一項的區塊裡。build 的 --human 列到的編號都要先記這一筆。
//   node evidence-page.mjs build <資料夾> --title <change 名>
//        [--tasks <tasks.md> --items 4.1,4.2,...] [--human 4.6,...] [--changed-from <檔案|->]
//     產生 <資料夾>/index.html，印出路徑與各狀態的項目數。
//     --items  列為驗收項目的 task 編號
//     --human  其中有事要人親手驗的編號，每個都要先用 human 記過要驗什麼與原因：
//              有證據又在 --human ＝部分要人驗；沒有證據只在 --human ＝整項要人驗
//     --changed-from  這次改動的檔案清單，一行一檔，可直接接 change-list.mjs list 的輸出；
//                     給了才檢查截圖有沒有比最後一次改程式還早（測試檔不算）
//     同一個項目的紀錄，身分相同的截圖、指令相同的結果、要人驗的事，各取最後一筆，重驗後再記一次就會取代舊的。
//     不同身分的截圖都留下，頁面照身分分組。
//     有項目沒有證據也沒標進 --human、標進 --human 卻沒記原因、有截圖卻沒記環境、圖檔不在、截圖過期：
//     列出每一條該怎麼補，以結束碼 1 結束，不產生頁面。
import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'

const USAGE = '用法：evidence-page.mjs shot|cmd|env|human|build <資料夾> …（細節見檔頭）'
const [cmd, dirArg, ...rest] = process.argv.slice(2)
if (!['shot', 'cmd', 'env', 'human', 'build'].includes(cmd) || !dirArg) {
  console.error(USAGE)
  process.exit(1)
}

const dir = resolve(dirArg)
const LOG = join(dir, '紀錄.jsonl')
const VALUE_FLAGS = ['--items', '--role', '--cmd', '--result', '--check', '--why', '--url', '--title', '--tasks', '--human', '--changed-from']
const SHOT_FLAGS = ['--path', '--state']
const opts = {}
const shotArgs = []
const fail = (...lines) => {
  for (const l of lines) console.error(l)
  process.exit(1)
}
for (let i = 0; i < rest.length; i++) {
  const a = rest[i]
  if (a === '--shot') shotArgs.push({ file: rest[++i] ?? '' })
  else if (SHOT_FLAGS.includes(a)) {
    if (!shotArgs.length) fail(`${a} 要接在 --shot <圖檔> 後面`)
    shotArgs.at(-1)[a.slice(2)] = rest[++i] ?? ''
  }
  else if (VALUE_FLAGS.includes(a)) opts[a.slice(2)] = rest[++i] ?? ''
  else fail(`看不懂的參數：${a}`, USAGE)
}
const list = s => (s ?? '').split(/[,，\s]+/).filter(Boolean)

function append(record) {
  mkdirSync(dir, { recursive: true })
  appendFileSync(LOG, `${JSON.stringify({ at: new Date().toISOString(), ...record })}\n`)
}

// 只留網域後面那段：驗證用的 dev server 跑完就關，人要貼到自己的環境用
function pathOnly(p) {
  try {
    const u = new URL(p)
    return u.pathname + u.search + u.hash
  }
  catch {
    return p
  }
}

if (cmd === 'shot') {
  if (!shotArgs.length) fail('shot 要給至少一組 --shot <圖檔> --path <路徑> --state <狀態>，值用單引號包起來')
  const shots = shotArgs.map((s) => {
    if (!s.path) fail(`${s.file}：要給 --path，寫截圖當下的網址，人要靠它回到同一頁`)
    if (!s.state) fail(`${s.file}：要給 --state，一句話寫這張是在什麼狀態下拍的`)
    const abs = isAbsolute(s.file) ? s.file : resolve(s.file)
    const inDir = existsSync(abs) && !relative(dir, abs).startsWith('..') ? abs : join(dir, basename(s.file))
    if (!existsSync(inDir)) fail(`找不到圖檔 ${s.file}：截圖時把檔名指定到 ${dir}/ 底下，再記一次`)
    return { file: relative(dir, inDir), path: pathOnly(s.path), state: s.state }
  })
  append({ items: list(opts.items), role: opts.role || undefined, shots })
  console.log(`已記：${shots.map(s => `${s.file}（${s.path}）`).join('、')}${opts.items ? ` → ${list(opts.items).join('、')}` : ''}`)
  process.exit(0)
}

if (cmd === 'cmd') {
  if (!opts.items || !opts.cmd || !opts.result) fail('cmd 要給 --items、--cmd、--result')
  append({ items: list(opts.items), cmd: opts.cmd, result: opts.result })
  console.log(`已記：${opts.cmd} → ${opts.result}`)
  process.exit(0)
}

if (cmd === 'env') {
  if (!opts.url) fail('env 要給 --url，寫驗證時 app 的網址')
  append({ env: { url: opts.url } })
  console.log(`已記環境：${opts.url}`)
  process.exit(0)
}

if (cmd === 'human') {
  if (!opts.items || !opts.check || !opts.why) fail('human 要給 --items、--check（要人驗什麼）、--why（為什麼自動檢查接不住）')
  append({ items: list(opts.items), check: opts.check, why: opts.why })
  console.log(`已記：${list(opts.items).join('、')} 要人驗 ${opts.check}`)
  process.exit(0)
}

// ---- build ----
const itemIds = list(opts.items)
const human = new Set(list(opts.human))
const title = opts.title || basename(dir)

// tasks.md 的項目：「- [x] 4.2 內容」，內容可換行縮排接續
const taskText = new Map()
let taskTotal = 0
if (opts.tasks) {
  if (!existsSync(opts.tasks)) fail(`找不到 tasks 檔：${opts.tasks}`)
  let current = null
  for (const line of readFileSync(opts.tasks, 'utf8').split('\n')) {
    const m = line.match(/^\s*[-*] \[[ xX]\]\s+([A-Za-z]?\d+(?:\.\d+)*)[.、:：]?\s+(.*)$/)
    if (m) {
      taskTotal++
      current = m[1]
      taskText.set(current, m[2].trim())
    }
    else if (current && /^\s+\S/.test(line) && !/^\s*[-*] /.test(line)) {
      taskText.set(current, `${taskText.get(current)} ${line.trim()}`)
    }
    else {
      current = null
    }
  }
}
else if (itemIds.length) {
  fail('給了 --items 就要給 --tasks <tasks.md>，項目原文從那裡讀')
}

const records = existsSync(LOG)
  ? readFileSync(LOG, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  : []
// 每一項的證據：身分相同的截圖、指令相同的結果，後記的取代先記的；不同身分的都留
const byItem = new Map()
const humanNote = new Map()
const byScreen = new Map()
let env = null
for (const r of records) {
  if (r.env) env = r.env
  else if (r.check) for (const id of r.items) humanNote.set(id, r)
  else if (r.items?.length) {
    const key = r.shots ? `shot:${r.role ?? ''}` : `cmd:${r.cmd}`
    for (const id of r.items) {
      if (!byItem.has(id)) byItem.set(id, new Map())
      byItem.get(id).delete(key)
      byItem.get(id).set(key, r)
    }
  }
  else for (const s of r.shots ?? []) byScreen.set(s.file, { ...r, shots: [s] })
}
const evidenceOf = id => [...(byItem.get(id)?.values() ?? [])]

const problems = []
for (const id of itemIds) {
  if (!taskText.has(id)) problems.push(`${id}：tasks.md 裡找不到這個編號，確認編號後重跑`)
  else if (!human.has(id) && !byItem.has(id)) problems.push(`${id}：沒有任何紀錄。補驗後用 shot 或 cmd 記一筆；流程裡接不住就用 human 記要人驗什麼與原因，再加進 --human`)
  else if (human.has(id) && !humanNote.has(id)) problems.push(`${id}：列在 --human 但沒記原因。用 human 記一筆：--items ${id} --check '<要人驗什麼>' --why '<為什麼自動檢查接不住>'`)
}

const listed = itemIds.filter(id => taskText.has(id))
const used = [...new Set(listed.flatMap(evidenceOf)), ...byScreen.values()]

// 截圖要比最後一次改程式晚；測試檔改了不影響畫面，不算
const isTest = p => /(^|\/)(tests?|__tests__|e2e)\//i.test(p) || /\.(test|spec)\.[^./]+$/.test(p)
let newest = null
if (opts['changed-from'] !== undefined) {
  let root = process.cwd()
  try {
    root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  }
  catch {}
  const text = readFileSync(opts['changed-from'] === '-' ? 0 : opts['changed-from'], 'utf8')
  for (const line of text.split('\n')) {
    const p = line.split('\t').pop().trim()
    if (!p || isTest(p)) continue
    const abs = isAbsolute(p) ? p : join(root, p)
    if (!existsSync(abs)) continue
    const t = statSync(abs).mtimeMs
    if (!newest || t > newest.t) newest = { t, p }
  }
}
for (const r of used) {
  const redo = r.items?.length ? `重走 ${r.items.join('、')}` : '重走這個畫面'
  for (const s of r.shots ?? []) {
    const abs = join(dir, s.file)
    if (!existsSync(abs)) problems.push(`${s.file}：圖檔不在 ${dir}，重拍後再記一次`)
    else if (newest && statSync(abs).mtimeMs < newest.t) problems.push(`${s.file}：截圖比 ${newest.p} 的最後修改還早。${redo}、重拍後再記一次`)
  }
}
if (!env && used.some(r => r.shots)) problems.push("有截圖但沒記網址。用 env 記一筆：--url '<驗證時 app 的網址>'")
if (problems.length) fail('驗收頁沒有產生，先補齊：', ...problems.map(p => `- ${p}`))
if (!listed.length && !used.length) {
  console.log('沒有證據可放，未產生驗收頁')
  process.exit(0)
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const rich = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>')
const pad = n => String(n).padStart(2, '0')
const stamp = (d) => {
  const t = new Date(d)
  return `${pad(t.getMonth() + 1)}-${pad(t.getDate())} ${pad(t.getHours())}:${pad(t.getMinutes())}`
}
const figure = (s, role) => `<figure><a href="${esc(encodeURI(s.file))}"><img src="${esc(encodeURI(s.file))}" alt="${esc(s.state)}"></a><figcaption><code>${esc(s.path)}</code><span>${role ? `${esc(role)}｜` : ''}${esc(s.state)}</span><time>${stamp(statSync(join(dir, s.file)).mtime)}</time></figcaption></figure>`
const shots = figures => `<div class="shots${figures.length > 1 ? ' many' : ''}">${figures.join('\n')}</div>`

// 每一項的狀態：已驗完／有證據但部分要人驗／整項要人驗
const STATE = {
  ok: { mark: '✓', text: '已驗完' },
  part: { mark: '◐', text: '部分要你驗' },
  todo: { mark: '○', text: '整項要你驗' },
}
const stateOf = id => !byItem.has(id) ? 'todo' : human.has(id) ? 'part' : 'ok'
const tally = { ok: 0, part: 0, todo: 0 }
for (const id of listed) tally[stateOf(id)]++

// 每個項目一塊：狀態、原文、拍了幾張截圖、要人驗什麼與原因，最後是截圖（照身分分組）。指令結果不印
function block(id) {
  const state = stateOf(id)
  const ev = evidenceOf(id)
  const shotRecs = ev.filter(r => r.shots)
  const total = shotRecs.reduce((n, r) => n + r.shots.length, 0)
  const byRole = shotRecs.some(r => r.role)
  const done = []
  if (total) done.push(`<dd>${total} 張截圖${byRole ? `：${shotRecs.map(r => `${esc(r.role ?? '沒標身分')} ${r.shots.length} 張`).join('、')}` : ''}</dd>`)
  const note = human.has(id) ? humanNote.get(id) : null
  const rows = [
    done.length ? `<dt>已驗到</dt>${done.join('')}` : '',
    note ? `<dt class="ask">要你驗</dt><dd>${rich(note.check)}</dd><dt class="ask">原因</dt><dd>${rich(note.why)}</dd>` : '',
  ].join('')
  const pics = shotRecs.map(r => `${byRole ? `<h3>${esc(r.role ?? '沒標身分')}</h3>\n` : ''}${shots(r.shots.map(s => figure(s)))}`).join('\n')
  return `<section>
<h2><i class="${state}"></i><b>${esc(id)}</b><span>${STATE[state].text}</span></h2>
<p class="task">${rich(taskText.get(id))}</p>
<dl>${rows}</dl>
${pics}
</section>`
}
const groupHtml = listed.map(block).join('\n')
const screenHtml = byScreen.size
  ? `<h2 class="more">改到的畫面</h2>\n<section>${shots([...byScreen.values()].map(r => figure(r.shots[0], r.role)))}</section>`
  : ''

// 複測環境：網址、截圖時登入過的身分
const roles = [...new Set(used.filter(r => r.shots && r.role).map(r => r.role))]
const envHtml = env
  ? `<section class="env">
<h2>複測環境</h2>
<dl><dt>網址</dt><dd><code>${esc(env.url)}</code></dd>${roles.length ? `<dt>登入的帳號</dt><dd>${roles.map(esc).join('<br>')}</dd>` : ''}</dl>
</section>`
  : ''

const present = Object.keys(STATE).filter(k => tally[k])
const count = listed.length
  ? `${listed.length} 項驗收：${present.map(k => `${STATE[k].mark} ${tally[k]}`).join('、')}`
  : `改到的畫面 ${byScreen.size} 個`
const legend = listed.length
  ? `<p class="legend">${present.map(k => `<span><i class="${k}"></i>${STATE[k].text} ${tally[k]}</span>`).join('')}</p>`
  : ''
const footer = listed.length ? `<footer>tasks 共 ${taskTotal} 項，其中 ${listed.length} 項列為驗收項目</footer>` : ''

const html = `<!doctype html>
<html lang="zh-Hant">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}｜驗收頁</title>
<style>
:root { color-scheme: light dark; --fg: #1c1c1c; --dim: #6b6b6b; --line: #e3e3e3; --bg: #fff; --soft: #f6f6f6; --ok: #1a8f4c; --warn: #c27a00; }
@media (prefers-color-scheme: dark) { :root { --fg: #e6e6e6; --dim: #9a9a9a; --line: #333; --bg: #161616; --soft: #1f1f1f; --ok: #3fb26c; --warn: #e0a030; } }
body { margin: 0 auto; padding: 32px 20px 64px; max-width: 960px; background: var(--bg); color: var(--fg); font: 15px/1.7 system-ui, -apple-system, "PingFang TC", "Noto Sans TC", sans-serif; }
header { margin-bottom: 24px; }
h1 { margin: 0; font-size: 20px; }
header p { margin: 4px 0 0; color: var(--dim); }
section { padding: 24px 0; border-top: 1px solid var(--line); }
h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 16px; font-weight: 600; }
h2 b { font-variant-numeric: tabular-nums; }
h2 span { font-weight: 500; }
h2.more { margin-top: 40px; font-size: 15px; color: var(--dim); font-weight: 500; }
h3 { margin: 20px 0 8px; font-size: 14px; font-weight: 600; }
.task { margin: 6px 0 0; color: var(--dim); }
dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 4px 14px; margin: 12px 0 0; }
dl:empty { display: none; }
.env code { user-select: all; }
dt { color: var(--dim); }
dt.ask { color: var(--warn); font-weight: 600; }
dd { grid-column: 2; margin: 0; }
dl + .shots { margin-top: 16px; }
i { flex: none; box-sizing: border-box; display: inline-block; width: 16px; height: 16px; border-radius: 50%; }
i.ok { background: var(--ok) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4.3 8.3l2.5 2.5 5-5.4' fill='none' stroke='%23fff' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/16px no-repeat; }
i.part { border: 2px solid var(--warn); background: linear-gradient(90deg, var(--warn) 50%, transparent 50%); }
i.todo { border: 2px solid var(--warn); }
.legend { display: flex; flex-wrap: wrap; gap: 4px 18px; font-size: 13px; }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.legend i { margin: 0; width: 13px; height: 13px; background-size: 13px; }
code { padding: 1px 5px; border-radius: 4px; background: var(--soft); font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
.shots { display: grid; gap: 16px; }
.shots.many { grid-template-columns: repeat(2, minmax(0, 1fr)); }
@media (max-width: 640px) { .shots.many { grid-template-columns: 1fr; } }
figure { margin: 0; min-width: 0; }
img { display: block; width: 100%; border: 1px solid var(--line); border-radius: 6px; }
figcaption, footer { color: var(--dim); font-size: 13px; }
figcaption { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px; margin-top: 6px; }
figcaption code { user-select: all; }
figcaption span { color: var(--fg); }
time { font-variant-numeric: tabular-nums; }
header time { margin-left: 10px; }
footer { margin-top: 12px; padding-top: 16px; border-top: 1px solid var(--line); }
</style>
<header>
<h1>${esc(title)}</h1>
<p>${listed.length ? `${listed.length} 項驗收` : count}<time>${stamp(new Date())} 產生</time></p>
${legend}
</header>
${envHtml}
${groupHtml}
${screenHtml}
${footer}
</html>
`
const out = join(dir, 'index.html')
writeFileSync(out, html)
console.log(out)
console.log(count)
