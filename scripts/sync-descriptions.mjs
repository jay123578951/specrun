#!/usr/bin/env node
// 版號一致性檢查（發版前跑）。
//
// 註：0.12.0 起 command 包裝層移除、skill 直接作為斜線指令，
// 原本「command description ← skill description」的生成同步已無對象，故此腳本收斂為純版號比對。
// 版號多處同值、無主體可抄，故用「比對」不用「生成」：
//   plugin.json version == marketplace plugins[].version == marketplace metadata.version
//
// 用法：node scripts/sync-descriptions.mjs   # 版號不一致時 exit 1

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const pluginJson = JSON.parse(readFileSync(join(root, 'plugins/srun/.claude-plugin/plugin.json'), 'utf8'))
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
  process.exit(1)
}
console.log(`= 版號一致：${values[0]}`)
