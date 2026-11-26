---
name: ig-weekly
description: 排一整週 IG 內容計畫：每天發什麼、形式、hook、拍攝清單與建議發文時間，可選擇送進 Metricool 當待審核排程。說「排下週」「這週要發什麼」時用。
---

# /ig-weekly：整週計畫

## 步驟
1. 讀 `.claude/ig/voice.md`；讀 `.claude/ig/viral/` 最新一份與上週計畫（`.claude/ig/weekly/`，如果有）。
2. 問（或用預設）：這週要發幾篇（預設 Reel 3 + 輪播 2 + 每日限動）、有沒有要推的活動 / 新品 / 公休、可拍攝的時段。
3. 發文時間：有 Metricool 連接器就用 `getBestTimeToPostByNetwork`（instagram）；沒有就用預設（平日 12:00、20:00）並註明是預設。
4. 輸出週表：

   | 日期 | 時間 | 形式 | 支柱 | 主題 / hook | 狀態 |
   |---|---|---|---|---|---|

   原則：支柱輪替、同形式不連發、至少 1 支是 `/ig-viral` 延伸的已驗證題材、活動前 2–3 天就要預熱。
5. 附「拍攝批次清單」：把同場景的鏡頭集中，一次拍完。
6. 存到 `.claude/ig/weekly/YYYY-Www.md`。
7. 若使用者說要排程：用 Metricool 的 `createScheduledPostForReview` 建成**待審核**，不直接發布；建之前列出清單讓使用者確認。
