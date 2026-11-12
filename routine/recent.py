#!/usr/bin/env python3
"""지난 브리핑에 실린 소식을 읽는다. 수집(fetch_sources.py)과 검사(publish.py)가 함께 쓴다.

같은 기사가 주소 끝의 꼬리표(?input=1195m, utm_source 등)만 달라져서 다시 실리는 일을 막으려고
주소를 한 가지 모양으로 줄여서 비교한다.
"""
import datetime as dt
import json
import os
import re
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 기사 내용과 상관없는 꼬리표. 기사 번호(idxno, no, boardSeq 등)는 남긴다.
TRACKING = re.compile(r"^(utm_.+|input|section|fbclid|gclid|ref|from)$", re.I)


def norm_url(url):
    """비교용 주소: http/https, www./m., 끝의 /, 꼬리표를 무시한다."""
    p = urllib.parse.urlsplit((url or "").strip())
    host = p.netloc.lower()
    for prefix in ("www.", "m."):
        if host.startswith(prefix):
            host = host[len(prefix):]
    query = sorted((k, v) for k, v in urllib.parse.parse_qsl(p.query, keep_blank_values=True)
                   if not TRACKING.match(k))
    return host + p.path.rstrip("/") + ("?" + urllib.parse.urlencode(query) if query else "")


def recent_items(before, days=7, root=ROOT):
    """before(YYYY-MM-DD) 바로 전 days 일 동안 실린 소식 목록. 최근 날짜가 먼저."""
    day = dt.date.fromisoformat(before)
    out = []
    for i in range(1, days + 1):
        d = (day - dt.timedelta(days=i)).isoformat()
        path = os.path.join(root, "briefings", d + ".json")
        if not os.path.exists(path):
            continue
        try:
            with open(path, encoding="utf-8") as f:
                items = json.load(f).get("items", [])
        except Exception:
            continue
        for it in items:
            out.append({"date": d, "category": it.get("category", ""), "title": it.get("title", ""),
                        "source": it.get("source", ""), "url": it.get("url", "")})
    return out
