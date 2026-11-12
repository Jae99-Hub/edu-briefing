#!/usr/bin/env python3
"""브리핑 파일을 검사하고 목록(briefings/index.json)에 올린다.

사용법: python routine/publish.py briefings/2026-11-11.json
검사에 걸리면 무엇이 잘못됐는지 알리고 종료 코드 1로 끝난다 (목록은 건드리지 않는다).
"""
import json
import os
import re
import sys

from recent import norm_url, recent_items

ROOT =os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATEGORIES = ["교과서 · 교육과정", "중학 영어 · 내신", "정책 · 제도", "학원 운영", "에듀테크 · AI", "입시 · 고입", "학원가 소식"]


def check(path):
    errors = []
    name = os.path.basename(path)
    m = re.fullmatch(r"(\d{4}-\d{2}-\d{2})\.json", name)
    if not m:
        return None, ["파일 이름은 YYYY-MM-DD.json 이어야 한다: " + name]
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if data.get("date") != m.group(1):
        errors.append("date 값이 파일 이름과 다르다")
    items = data.get("items")
    if not isinstance(items, list):
        return data, errors + ["items 가 목록이 아니다"]
    if len(items) > 7:
        errors.append("항목이 7개를 넘는다 (%d개)" % len(items))
    if not items and not (data.get("note") or "").strip():
        errors.append("항목이 없으면 note 에 이유를 적어야 한다")
    seen = set()
    # 지난 7일 브리핑에 실린 주소. 같은 기사를 다시 싣지 않는다.
    past = {}
    for r in recent_items(m.group(1)):
        past.setdefault(norm_url(r["url"]), r["date"])
    for i, it in enumerate(items, 1):
        for key in ("category", "title", "summary", "source", "url"):
            if not str(it.get(key) or "").strip():
                errors.append("%d번 항목: %s 가 비어 있다" % (i, key))
        url = str(it.get("url") or "")
        if not re.match(r"^https?://", url):
            errors.append("%d번 항목: url 이 http 주소가 아니다" % i)
        if "news.google.com" in url or "search.naver.com" in url:
            errors.append("%d번 항목: 검색 중계 주소다. 언론사 원문 주소로 바꿔야 한다" % i)
        key = norm_url(url)
        if key in seen:
            errors.append("%d번 항목: 같은 주소가 두 번 나온다" % i)
        seen.add(key)
        if key in past:
            errors.append("%d번 항목: %s 브리핑에 이미 실린 기사다. 이 항목을 뺀다" % (i, past[key]))
        if it.get("category") not in CATEGORIES:
            errors.append("%d번 항목: category 는 %s 중 하나여야 한다" % (i, " / ".join(CATEGORIES)))
        if len(str(it.get("summary") or "")) > 400:
            errors.append("%d번 항목: summary 가 400자를 넘는다" % i)
        card = str(it.get("card_title") or "")
        key = str(it.get("keyword") or "")
        if len(card) > 24:
            errors.append("%d번 항목: card_title 이 24자를 넘는다" % i)
        if key and key not in (card or str(it.get("title") or "")):
            errors.append("%d번 항목: keyword 가 card_title 안에 그대로 없다" % i)
    return data, errors


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        return 1
    path = sys.argv[1]
    data, errors = check(path)
    if errors:
        print("검사 실패:")
        for e in errors:
            print(" -", e)
        return 1
    index_path = os.path.join(ROOT, "briefings", "index.json")
    index = {"dates": []}
    if os.path.exists(index_path):
        with open(index_path, encoding="utf-8") as f:
            index = json.load(f)
    dates = set(index.get("dates", []))
    dates.add(data["date"])
    index["dates"] = sorted(dates, reverse=True)
    with open(index_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print("검사 통과: %s (%d개 항목). 목록에 %d일 치가 있다." % (data["date"], len(data["items"]), len(index["dates"])))
    return 0


if __name__ == "__main__":
    sys.exit(main())
