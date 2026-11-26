#!/usr/bin/env python3
"""爆款排名：把每支 Reel 的觀看數除以「該帳號的平常水準」，算出倍數後排序。

平常水準 = 同帳號其他 Reel 觀看數的中位數（不含自己，避免爆款拉高自己的基準）。
用中位數而不是平均，是因為一支爆款就會把平均拉歪。

用法：
  python3 rank.py reels.csv [--top 10] [--min-x 2] [--days 90] [--min-reels 4] [--json]

CSV 欄位：account,url,date,views[,likes,comments,caption]
觀看數可寫 12000、12,000、1.2萬、12K、1.2M。
"""
import argparse
import csv
import json
import re
import statistics
import sys
from datetime import date, datetime, timedelta


def parse_num(s):
    s = (s or "").strip().replace(",", "").replace(" ", "")
    if not s:
        return None
    m = re.fullmatch(r"([\d.]+)\s*(萬|万|k|K|m|M|億|亿)?", s)
    if not m:
        return None
    n = float(m.group(1))
    mult = {"萬": 1e4, "万": 1e4, "k": 1e3, "K": 1e3, "m": 1e6, "M": 1e6, "億": 1e8, "亿": 1e8}
    return n * mult.get(m.group(2), 1)


def parse_date(s):
    s = (s or "").strip()[:10]
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def load(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = []
        for i, r in enumerate(csv.DictReader(f), start=2):
            r = {k.strip().lower(): (v or "").strip() for k, v in r.items() if k}
            views = parse_num(r.get("views"))
            acct = r.get("account", "")
            if not acct or views is None:
                print(f"略過第 {i} 列：缺 account 或 views 無法辨識", file=sys.stderr)
                continue
            if not acct.startswith("@"):
                acct = "@" + acct
            rows.append({
                "account": acct,
                "url": r.get("url", ""),
                "date": parse_date(r.get("date")),
                "views": views,
                "likes": parse_num(r.get("likes")),
                "comments": parse_num(r.get("comments")),
                "caption": r.get("caption", ""),
            })
    return rows


def rank(rows, min_reels=4, days=None):
    if days:
        cutoff = date.today() - timedelta(days=days)
        rows = [r for r in rows if r["date"] is None or r["date"] >= cutoff]
    by_acct = {}
    for r in rows:
        by_acct.setdefault(r["account"], []).append(r)
    out, skipped = [], []
    for acct, reels in by_acct.items():
        if len(reels) < min_reels:
            skipped.append((acct, len(reels)))
            continue
        for r in reels:
            others = [o["views"] for o in reels if o is not r]
            base = statistics.median(others)
            if base <= 0:
                continue
            eng = None
            if r["likes"] is not None and r["views"]:
                eng = (r["likes"] + (r["comments"] or 0)) / r["views"]
            out.append({**r, "baseline": base, "x": r["views"] / base, "engagement": eng,
                        "date": r["date"].isoformat() if r["date"] else ""})
    out.sort(key=lambda r: r["x"], reverse=True)
    return out, skipped


def fmt_n(n):
    if n >= 1e4:
        return f"{n / 1e4:.1f}萬".replace(".0萬", "萬")
    return f"{int(n):,}"


def bar(x, top, width=20):
    filled = max(1, round(width * min(x, top) / top)) if top > 0 else 0
    return "█" * filled + "░" * (width - filled)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv")
    ap.add_argument("--top", type=int, default=10)
    ap.add_argument("--min-x", type=float, default=0, help="只顯示倍數 ≥ 此值（建議 2）")
    ap.add_argument("--days", type=int, default=None, help="只看最近 N 天")
    ap.add_argument("--min-reels", type=int, default=4, help="帳號至少要幾支 Reel 才算得出平常水準")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()

    ranked, skipped = rank(load(a.csv), a.min_reels, a.days)
    ranked = [r for r in ranked if r["x"] >= a.min_x][: a.top]

    if a.json:
        json.dump({"ranked": ranked, "skipped": skipped}, sys.stdout, ensure_ascii=False, indent=2)
        print()
        return

    if not ranked:
        print("沒有符合條件的 Reel。")
    else:
        top = ranked[0]["x"]
        print(f"爆款排名（倍數 = 觀看數 ÷ 該帳號平常水準）\n")
        print("| # | 帳號 | 倍數 | | 觀看 | 平常 | 互動率 | 日期 | 文案開頭 | 連結 |")
        print("|---|---|---|---|---|---|---|---|---|---|")
        for i, r in enumerate(ranked, 1):
            eng = f"{r['engagement'] * 100:.1f}%" if r["engagement"] is not None else "–"
            cap = r["caption"].replace("|", "／").replace("\n", " ")[:24]
            print(f"| {i} | {r['account']} | **{r['x']:.1f}×** | `{bar(r['x'], top, 12)}` | "
                  f"{fmt_n(r['views'])} | {fmt_n(r['baseline'])} | {eng} | {r['date']} | {cap} | {r['url']} |")
    for acct, n in skipped:
        print(f"\n註：{acct} 只有 {n} 支 Reel（少於 {a.min_reels}），算不出可靠的平常水準，已略過。", file=sys.stderr)


if __name__ == "__main__":
    main()
