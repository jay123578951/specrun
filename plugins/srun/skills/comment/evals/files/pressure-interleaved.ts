export function runMigration(rows: Row[]) {
  // prettier-ignore
  const COLS = ['id',    'status',    'updated_at']   // 手動對齊欄位，別讓 formatter 打散
  for (const row of rows) {
    // 印出進度
    // eslint-disable-next-line no-console
    console.log(`migrating ${row.id}`)
    // 組更新語句
    // @ts-expect-error 第三方 client 型別漏了 exec 多載，runtime 上這個方法存在
    db.exec(`UPDATE t SET status = 'done' WHERE id = ${row.id}`)
    // const prev = db.query(row.id)   // 舊寫法，已淘汰
  }
}
