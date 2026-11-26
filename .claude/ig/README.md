# IG 小團隊：13 個 Claude skill

住在 Claude 裡的 IG 小團隊。它寫好，你按發布：不自動發文、不登入你的帳號、不爬資料，帳號安全。

## 開始
1. 在這個 repo 開 Claude Code。
2. 先跑 `/ig-voice`，填好你的聲音檔 `.claude/ig/voice.md`。
3. 之後任何一個 skill 都可以直接用。

## 13 個 skill
| 指令 | 做什麼 |
|---|---|
| `/ig-voice` | 建立你的聲音檔（語氣、受眾、範例），其他 skill 都靠它 |
| `/ig-viral` ⭐ | **爆款**：找出領域裡超出該帳號平常水準幾倍的 Reel，依倍數排名，再用你的聲音重寫 |
| `/ig-reel-script` | 寫 Reel 腳本（分鏡、口播、字卡、CTA） |
| `/ig-hook` | 開頭 hook 打分 0–100 + 改寫 5 版 |
| `/ig-caption` | 文案 + hashtag |
| `/ig-carousel` | 輪播逐頁內容 |
| `/ig-ideas` | 選題發想（依內容支柱） |
| `/ig-reply` | 回留言（分類 + 逐則草擬） |
| `/ig-dm` | 回私訊 / 私訊範本 |
| `/ig-profile` | 主頁打分 0–100 + Bio 改寫 |
| `/ig-weekly` | 排整週計畫，可送 Metricool 當待審核排程 |
| `/ig-report` | 成效報告（用 Metricool 或你的截圖） |
| `/ig-repurpose` | 一稿多用：Reel → 輪播 / 限動 / Threads |

## 爆款怎麼算
倍數 = 這支 Reel 的觀看 ÷ 同帳號**其他** Reel 觀看的中位數。

跟帳號自己的平常水準比，小帳號的爆款也找得出來；用中位數，一支爆款就不會把基準拉歪。每個帳號至少要 4 支 Reel 才會算。

資料填在 CSV（範本：`data/reels-template.csv`），手動抄對標帳號 Reels 分頁上的觀看數就好。也可以直接把數字或截圖貼給 Claude，它會幫你整理。

```bash
python3 .claude/skills/ig-viral/scripts/rank.py .claude/ig/data/reels-template.csv --min-x 2
```

## 資料夾
- `voice.md`：你的聲音檔
- `data/`：Reel 數據 CSV
- `viral/`、`scripts/`、`weekly/`、`reports/`：各 skill 產出的存檔
