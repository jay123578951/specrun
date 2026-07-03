---
description: Pipeline 回饋迴路（雙模式）— 記錄模式（預設）：code-feat/code-fix 完成時對照事件表，把偏離快樂路徑的事件與統計 append 進 ~/.claude/sdd-kit-feedback/runs.jsonl 跨專案收件匣（手動呼叫＝臨時補記）；歸檔模式（--archive）：聚類收件匣找跨專案模式、必要時順 session 指針開採 transcripts，產出附證據的 kit 優化提案，徵求同意後歸檔。受益對象是 kit 不是專案——教訓寫回 kit 的 prompt，不寫專案 CLAUDE.md。
argument-hint: "[--archive]"
---

Use the Skill tool to invoke the `code-retro` skill, passing along any arguments the user provided.

$ARGUMENTS
