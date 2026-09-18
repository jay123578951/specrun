#!/usr/bin/env node
// retro 的用時與 token 統計：讀 Claude Code transcript 算出本次 run 的時間去哪、token 花多少。
// 用法：node retro-usage.mjs [session-id] [--since <ISO 時間>] [--project <專案目錄>]
//   session-id 省略時，取 --project（預設 cwd）對應 transcript 目錄裡最近修改的一份
//   --since 只統計該時間之後的訊息（傳 pipeline 起跑時間，排除 run 之前的討論）
// 輸出：單行 JSON，直接併進 retro 條目的 usage 欄。純確定性計算，不靠模型記憶。
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const args = process.argv.slice(2)
let sessionId = null; let since = null; let project = process.cwd()
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--since') since = new Date(args[++i])
  else if (args[i] === '--project') project = args[++i]
  else sessionId = args[i]
}

const projectsRoot = join(homedir(), '.claude', 'projects')
const encoded = project.replace(/[\\/.]/g, '-')
let transcript = null
if (sessionId) {
  for (const dir of readdirSync(projectsRoot)) {
    const p = join(projectsRoot, dir, `${sessionId}.jsonl`)
    if (existsSync(p)) { transcript = p; break }
  }
} else {
  const dir = join(projectsRoot, encoded)
  if (existsSync(dir)) {
    const files = readdirSync(dir).filter(f => f.endsWith('.jsonl'))
      .map(f => ({ f, m: statSync(join(dir, f)).mtimeMs })).sort((a, b) => b.m - a.m)
    if (files.length) { transcript = join(dir, files[0].f); sessionId = files[0].f.slice(0, -6) }
  }
}
if (!transcript) { console.error(`找不到 transcript（session=${sessionId ?? '自動'}，project=${encoded}）`); process.exit(1) }

const readJsonl = p => readFileSync(p, 'utf8').split('\n').filter(Boolean).flatMap(l => { try { return [JSON.parse(l)] } catch { return [] } })
const ts = o => o.timestamp ? new Date(o.timestamp) : null
const inWindow = o => { const t = ts(o); return t && (!since || t >= since) }
const sumUsage = (acc, u) => {
  acc.inTok += u.input_tokens || 0; acc.outTok += u.output_tokens || 0
  acc.cacheWriteTok += u.cache_creation_input_tokens || 0; acc.cacheReadTok += u.cache_read_input_tokens || 0
  return acc
}
const emptyUsage = () => ({ inTok: 0, outTok: 0, cacheWriteTok: 0, cacheReadTok: 0 })
const min = (a, b) => a && b ? +((b - a) / 60000).toFixed(1) : null

const main = readJsonl(transcript).filter(inWindow)
const mainUsage = emptyUsage(); const models = {}
let first = null, last = null
const dispatches = []
const humanGaps = []; let lastAssistantTs = null
const isHuman = o => {
  if (o.type !== 'user' || o.isMeta) return false
  const c = (o.message || {}).content
  if (typeof c === 'string') return !c.startsWith('<task-notification>') && !c.startsWith('<local-command')
  return Array.isArray(c) && !c.some(p => p.type === 'tool_result')
}
for (const o of main) {
  const t = ts(o); if (!t) continue
  first = first || t; last = t
  const msg = o.message || {}
  if (o.type === 'assistant') {
    lastAssistantTs = t
    if (msg.usage) { sumUsage(mainUsage, msg.usage); models[msg.model] = (models[msg.model] || 0) + 1 }
  }
  if (isHuman(o) && lastAssistantTs) { humanGaps.push([lastAssistantTs, t]); lastAssistantTs = null }
  const r = o.toolUseResult
  if (r && typeof r === 'object' && r.agentId) dispatches.push({ ts: t, description: r.description || '', model: r.resolvedModel || null, agentId: r.agentId })
}

const role = d => /coder/i.test(d) ? 'coder' : /tester/i.test(d) ? 'tester' : /re-?check/i.test(d) ? 'recheck' : /review/i.test(d) ? 'reviewer' : /verify|驗證|流程/i.test(d) ? 'verify' : /comment|註解/i.test(d) ? 'comment' : 'other'
const kind = d => /修復|修正|fix|retry|re-?check|re-?run|仲裁/i.test(d) ? 'fix' : 'first'
const batch = d => { const m = d.match(/第\s*(\d+)\s*批/); return m ? +m[1] : null }

const subDir = join(transcript.slice(0, -6), 'subagents')
const seen = new Set()
const out = []
const intervals = []
for (const d of dispatches) {
  const p = join(subDir, `agent-${d.agentId}.jsonl`); seen.add(d.agentId)
  const row = { role: role(d.description), batch: batch(d.description), kind: kind(d.description), model: d.model, min: null, ...emptyUsage(), description: d.description }
  if (existsSync(p)) {
    const lines = readJsonl(p); const u = emptyUsage(); const mc = {}; let a = null, b = null
    for (const o of lines) { const t = ts(o); if (!t) continue; a = a || t; b = t; const m = o.message || {}; if (m.usage) { sumUsage(u, m.usage); mc[m.model] = (mc[m.model] || 0) + 1 } }
    Object.assign(row, u, { min: min(a, b), model: Object.entries(mc).sort((x, y) => y[1] - x[1])[0]?.[0] || d.model })
    if (a && b) intervals.push([a, b])
  }
  out.push(row)
}
if (existsSync(subDir)) for (const f of readdirSync(subDir)) {
  const id = f.replace(/^agent-|\.jsonl$/g, ''); if (seen.has(id) || !f.endsWith('.jsonl')) continue
  const lines = readJsonl(join(subDir, f)).filter(inWindow); if (!lines.length) continue
  const u = emptyUsage(); const mc = {}; let a = null, b = null
  for (const o of lines) { const t = ts(o); if (!t) continue; a = a || t; b = t; const m = o.message || {}; if (m.usage) { sumUsage(u, m.usage); mc[m.model] = (mc[m.model] || 0) + 1 } }
  out.push({ role: 'other', batch: null, kind: 'first', model: Object.entries(mc).sort((x, y) => y[1] - x[1])[0]?.[0] || null, min: min(a, b), ...u, description: '（未對應到派發紀錄）' })
}

// 等人時間：助理最後一筆到人下一則訊息的空檔，扣掉同時有 subagent 在跑的部分
let waitingMs = 0
for (const [g0, g1] of humanGaps) {
  let covered = 0
  for (const [a, b] of intervals) { const lo = Math.max(a, g0), hi = Math.min(b, g1); if (hi > lo) covered += hi - lo }
  waitingMs += Math.max(0, (g1 - g0) - covered)
}

const byModel = {}
for (const r of out) { const m = r.model || 'unknown'; byModel[m] = byModel[m] || { dispatches: 0, min: 0, outTok: 0, inTok: 0, cacheWriteTok: 0, cacheReadTok: 0 }; const b = byModel[m]; b.dispatches++; b.min = +(b.min + (r.min || 0)).toFixed(1); b.outTok += r.outTok; b.inTok += r.inTok; b.cacheWriteTok += r.cacheWriteTok; b.cacheReadTok += r.cacheReadTok }

console.log(JSON.stringify({
  session: sessionId, since: since ? since.toISOString() : null,
  wallClockMin: min(first, last), dispatchMin: +out.reduce((s, r) => s + (r.min || 0), 0).toFixed(1), waitingHumanMin: +(waitingMs / 60000).toFixed(1),
  mainThread: { model: Object.entries(models).sort((x, y) => y[1] - x[1])[0]?.[0] || null, ...mainUsage },
  byModel, dispatches: out,
}))
