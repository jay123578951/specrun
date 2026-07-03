#!/usr/bin/env node
// 防 drift 機制（G13）：消滅副本優於監控副本。
//
// 1. command frontmatter 的 description 由對應 skill 的 description「生成」（single-source-generate）：
//    plugins/code/skills/code-<x>/SKILL.md → plugins/code/commands/<x>.md
//    command description 是建置產物，不再手寫；改了 skill description 後重跑本腳本即同步。
// 2. 版號一致性用「比對」不用生成（多處同值沒有主體可抄）：
//    plugin.json version == marketplace plugins[].version == marketplace metadata.version
//
// 用法：
//   node scripts/sync-descriptions.mjs           # 生成模式：寫入 command 檔
//   node scripts/sync-descriptions.mjs --check   # 檢查模式：不寫入，有待同步差異或版號不一致時 exit 1（發版前跑）

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const skillsDir = join(root, 'plugins/code/skills')
const commandsDir = join(root, 'plugins/code/commands')
const checkMode = process.argv.includes('--check')

let dirty = false
let failed = false

function frontmatterLines(content) {
  const lines = content.split('\n')
  if (lines[0] !== '---') return null
  const end = lines.indexOf('---', 1)
  if (end === -1) return null
  return { lines, end }
}

function getDescription(content) {
  const fm = frontmatterLines(content)
  if (!fm) return null
  const line = fm.lines.slice(1, fm.end).find(l => l.startsWith('description:'))
  return line ? line.slice('description:'.length).trim() : null
}

function setDescription(content, desc) {
  const fm = frontmatterLines(content)
  if (!fm) return null
  for (let i = 1; i < fm.end; i++) {
    if (fm.lines[i].startsWith('description:')) {
      fm.lines[i] = `description: ${desc}`
      return fm.lines.join('\n')
    }
  }
  return null
}

// 1) command description ← skill description（生成）
for (const skillName of readdirSync(skillsDir).sort()) {
  const skillFile = join(skillsDir, skillName, 'SKILL.md')
  const commandFile = join(commandsDir, `${skillName.replace(/^code-/, '')}.md`)
  if (!existsSync(skillFile)) continue
  if (!existsSync(commandFile)) continue // 無對應 command 的 skill（如 code-guidelines）跳過

  const desc = getDescription(readFileSync(skillFile, 'utf8'))
  if (!desc) {
    console.error(`✗ ${skillName}: SKILL.md 缺 description`)
    failed = true
    continue
  }

  const commandContent = readFileSync(commandFile, 'utf8')
  const updated = setDescription(commandContent, desc)
  if (updated === null) {
    console.error(`✗ ${skillName}: command 檔 frontmatter 缺 description 欄位`)
    failed = true
    continue
  }

  if (updated !== commandContent) {
    dirty = true
    if (checkMode) {
      console.error(`✗ ${skillName}: command description 與 skill 不同步（跑 node scripts/sync-descriptions.mjs 重新生成）`)
    }
    else {
      writeFileSync(commandFile, updated)
      console.log(`✔ ${skillName}: 已重新生成 command description`)
    }
  }
  else {
    console.log(`= ${skillName}: 已同步`)
  }
}

// 2) 版號一致性（比對）
const pluginJson = JSON.parse(readFileSync(join(root, 'plugins/code/.claude-plugin/plugin.json'), 'utf8'))
const marketplace = JSON.parse(readFileSync(join(root, '.claude-plugin/marketplace.json'), 'utf8'))
const marketplaceEntry = marketplace.plugins.find(p => p.name === pluginJson.name)

const versions = {
  'plugin.json version': pluginJson.version,
  'marketplace plugins[].version': marketplaceEntry?.version,
  'marketplace metadata.version': marketplace.metadata?.version,
}
const values = [...new Set(Object.values(versions))]
if (values.length !== 1) {
  console.error(`✗ 版號不一致：${Object.entries(versions).map(([k, v]) => `${k}=${v}`).join('，')}`)
  failed = true
}
else {
  console.log(`= 版號一致：${values[0]}`)
}

if (failed || (checkMode && dirty)) process.exit(1)
