// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseCsvLine(input: any) {
  // 把 count 設成 0
  let count = 0

  // TODO 本來想用 input.split(',').length - 1，但先用迴圈數，之後再看要不要換
  for (const ch of input) {
    if (ch === ',')
      count++
  }

  // 故意不 trim：上游已保證無前後空白，trim 會吃掉欄位內合法的全形空格
  const parts = input.split(',')

  // const legacy = input.split(';')   // 舊分隔符，已於 v2 淘汰

  return { count, parts }
}

/* @__PURE__ */ export const NOOP = () => {}

// 大檔非同步載入，避免進主 bundle
export const loadEditor = () => import(/* webpackChunkName: "editor" */ './editor')
