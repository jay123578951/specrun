// @ts-expect-error 第三方型別未涵蓋此 runtime-only 欄位
import { internalFlag } from 'third-party-lib'

// 用 WeakMap 而非 Map：讓 key 物件可被 GC，避免長生命週期快取洩漏
const cache = new WeakMap<object, string>()

export function memoize(key: object, compute: () => string) {
  if (!cache.has(key))
    cache.set(key, compute())
  return cache.get(key)!
}
