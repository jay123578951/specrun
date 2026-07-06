// eslint-disable-next-line no-console
export function report(data: unknown) {
  // 印出 data
  console.log(data)

  // 這裡用 as any 是因為 SDK 型別把 payload 標成 never，實際 runtime 是陣列
  const payload = (data as any).payload

  // let result = payload.map(x => x)   // 舊寫法，已改用下面的迴圈
  const result = []
  for (const x of payload) {
    result.push(x)
  }
  return result
}
