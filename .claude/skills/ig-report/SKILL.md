---
name: ig-report
description: IG 成效週報 / 月報：觸及、觀看、互動、追蹤成長，找出自己哪幾篇超出平常水準並說明原因與下一步。說「這週成效」「幫我看數據」時用。
---

# /ig-report：成效報告

## 步驟
1. 取資料（擇一）：
   - 有 Metricool 連接器：先 `getAnalyticsAvailableMetrics` 看 instagram 有哪些指標，再用 `getAnalyticsDataByMetrics` 抓期間資料（預設最近 7 天，並抓前一期做比較）。
   - 使用者貼 IG 洞察截圖或 CSV。
   - 都沒有：說明需要哪些數字，不要編。
2. 把自己的貼文整理成 `.claude/ig/data/` 的 CSV 格式（account 填自己），用 `/ig-viral` 的腳本算**自己的倍數**：
   ```bash
   python3 .claude/skills/ig-viral/scripts/rank.py <csv> --top 20
   ```
3. 報告內容：
   - 重點數字與上一期比較（↑↓ 百分比）
   - 本期前 3 名（倍數最高）與後 3 名，各一句「為什麼」的假設
   - 3 個下週行動（具體到題材或做法），可直接餵給 `/ig-weekly`
4. 存到 `.claude/ig/reports/YYYY-MM-DD.md`。只陳述有數據支持的結論，假設要標明是假設。
