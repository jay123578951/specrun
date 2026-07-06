# 阻塞輸出模板（feat／fix 共用）

Orchestrator 宣告阻塞時展開。`{變數}` 以實際值替換；debug 檔名——feat：`.claude/debug/{changeName}-{timestamp}.md`、fix：`.claude/debug/fix-{timestamp}.md`。

宣告阻塞前，先輸出 debug 檔（不放專案根目錄——檔案含完整 diff，`.claude/` 應由專案 gitignore 蓋掉）：

```markdown
## Pipeline 暫停：{changeName 或問題摘要}

### 阻塞原因
{最後一輪的錯誤訊息}

### Retry 歷程

#### Round 1
- Coder 修改：{檔案清單}
- 結果：{失敗原因}

#### Round 2
...

#### Round 3
...

### 當前 Diff
（附上 git diff 輸出）
```

然後向使用者顯示阻塞摘要：

```
## Pipeline 暫停：{changeName 或問題摘要}

### 問題
{問題描述}

### 已完成
- Coder: ✓
- Tester: ✗ 第 3 輪仍失敗

### Pipeline 統計
- Coder 派發次數：{coderCalls}
- Tester 派發次數：{testerCalls}
{feat 另列：Reviewer 派發次數}

### Debug 檔案
已輸出至 {debug 檔路徑}

### 選項
feat：1. 人工介入修復 2. 調整 spec/design 後重跑 3. 其他
fix： 1. 人工介入修復 2. 重新描述問題後重跑 3. 升級為 Tier 3（建立 OpenSpec change，走 /srun:feat）
```
